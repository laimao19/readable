const express = require('express');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});
const router = express.Router();

//helper function for streak calculation
function calculateStreak(lastActivity) {
  if (!lastActivity) {
    return { increment: 0, reset: true }; //streak as 1 for first activity
  }
  //getting the current date
  const now = new Date();
  //converting to date without time info
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  //getting the last activity date
  const lastActivityDate = new Date(lastActivity);
  const lastActivityDay = new Date(lastActivityDate.getFullYear(), lastActivityDate.getMonth(), lastActivityDate.getDate());
  //getting the date of yesterday
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  //if the last activity was today, streak doesn't change
  if (lastActivityDay.getTime() === today.getTime()) {
    return { increment: 0, reset: false };
  }
  //if the last activity was yesterday, increment the streak
  else if (lastActivityDay.getTime() === yesterday.getTime()) {
    return { increment: 1, reset: false };
  }
  //if more than a day has passed, reset the streak
  else {
    return { increment: 0, reset: true };
  }
}


//GET /api/user/stats
//gets user stats, creating them if they don't exist
router.get('/stats', ClerkExpressRequireAuth(), async (req, res, next) => {
    //get the clerk user id from the request
  const clerkUserId = req.auth.userId;
//if user isn't authenticated return error
  if (!clerkUserId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    //get the user status from the database
    let userStats = await prisma.userStats.findUnique({
      where: { clerkUserId: clerkUserId },
    });

    //if stats don't exist, create a new record for the user
    if (!userStats) {
      console.log(`No stats found for user ${clerkUserId}, creating default entry.`);
      //create a new record for the user
      userStats = await prisma.userStats.create({
        data: {
          clerkUserId: clerkUserId,
          readingLevel: 'beginner',
          streak: 1, 
          lastActivity: new Date() 
        },
      });
    } else {
      //if user has a last activity date calculate the streak
      if (userStats.lastActivity) {
        const streakUpdate = calculateStreak(userStats.lastActivity); //calculating the streak
        if (streakUpdate.reset && userStats.streak > 1) {
          //only update if the streak was broken (was > 1 and now reset)
          console.log(`Detected broken streak for user ${clerkUserId}. Resetting from ${userStats.streak} to 1.`);
          userStats = await prisma.userStats.update({
            where: { clerkUserId: clerkUserId },
            data: {
              streak: 1, //resetting streak due to inactivity
              updatedAt: new Date()
            }
          });
        }
      }
    }
    //return the user stats
    res.json(userStats);
  } catch (error) {
    console.error(`Error fetching/creating stats for user ${clerkUserId}:`, error);
    next(error); 
  }
});


//POST /api/user/diagnostic-complete ---
//updates stats after diagnostic completion
router.post('/diagnostic-complete', ClerkExpressRequireAuth(), async (req, res, next) => {
  //get the clerk user id from the request
  const clerkUserId = req.auth.userId;
  //getting request body data
  const { 
    difficultyLevel,
    readingTimeSeconds = 0,
    totalWords = 0
  } = req.body;

  if (!clerkUserId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }
  if (!difficultyLevel) {
    return res.status(400).json({ error: 'Missing difficultyLevel in request body' });
  }

  try {
    //finding the latest active reading session for diagnostic
    const activeSession = await prisma.readingSession.findFirst({
      where: {
        clerkUserId,
        exerciseType: 'diagnostic',
        inProgress: true
      },
      orderBy: { 
        startTime: 'desc' 
      }
    });

    let wordsPerMinute = 0;
    let finalizedReadingTimeSeconds = readingTimeSeconds; 
    if (activeSession) {
      const endTime = new Date(); //getting end time
      const startTime = new Date(activeSession.startTime); //getting start time
      finalizedReadingTimeSeconds = Math.max(1, (endTime - startTime) / 1000); //calculating reading time
      wordsPerMinute = activeSession.wordCount > 0 
        ? Math.round((activeSession.wordCount / finalizedReadingTimeSeconds) * 60) 
        : 0; //calculating WPM
      
      //updating sesssion
      await prisma.readingSession.update({
        where: {
          id: activeSession.id
        },
        data: {
          endTime,
          readingTimeSeconds: finalizedReadingTimeSeconds,
          wordsPerMinute,
          inProgress: false
        }
      });
    } else if (finalizedReadingTimeSeconds > 0 && totalWords > 0) {
      //if no active session was found, calculate WPM based on request body data
      wordsPerMinute = Math.round((totalWords / finalizedReadingTimeSeconds) * 60);
    }

    //get the current user stats from the database
    const currentStats = await prisma.userStats.findUnique({
        where: { clerkUserId: clerkUserId },
    });

    //if stats don't exist create a new record
    if (!currentStats) {
        await prisma.userStats.upsert({
          where: { clerkUserId },
          update: {}, 
          create: {
            clerkUserId,
            readingLevel: difficultyLevel || 'beginner', 
            streak: 1,
            lastActivity: new Date()
          }
        });
        currentStats = await prisma.userStats.findUnique({ where: { clerkUserId } });
        if (!currentStats) {
          return res.status(500).json({ error: 'Failed to create or find user stats.' });
        }
    }

    //preserve higher streaks if user already has one
    let newStreak = Math.max(1, currentStats.streak);
    if (currentStats.lastActivity) {
        const streakUpdate = calculateStreak(currentStats.lastActivity); //streak update
        if (streakUpdate.reset) { //if streak was broken
            newStreak = 1;
        } else if (streakUpdate.increment > 0) {
            newStreak += streakUpdate.increment;
        }
    }

    //updating average WPM
    let newAverageWPM = currentStats.averageWPM;
    if (wordsPerMinute > 0) {
      const completedSessions = await prisma.readingSession.findMany({
        where: { 
          clerkUserId, 
          inProgress: false,
          wordsPerMinute: { not: null }
        }
      });
      
      let totalWPM = completedSessions.reduce((sum, session) => sum + (session.wordsPerMinute || 0), 0);
      totalWPM += wordsPerMinute; 
      newAverageWPM = Math.round(totalWPM / (completedSessions.length + 1));
    }

    //update user stats
    const updatedStats = await prisma.userStats.update({
      where: { clerkUserId: clerkUserId },
      data: {
        readingLevel: difficultyLevel,
        totalReadingTime: { increment: Math.ceil(finalizedReadingTimeSeconds / 60) },
        progress: { increment: 5 },       
        streak: newStreak,               
        averageWPM: newAverageWPM,       
        lastActivity: new Date(),         
        updatedAt: new Date(),            
      },
    });
    res.json(updatedStats);
  } catch (error) {
    console.error(`Error updating diagnostic results for user ${clerkUserId}:`, error);
    next(error);
  }
});


//POST /api/user/exercise-complete ---
//update stats after a daily exercise or reading session
router.post('/exercise-complete', ClerkExpressRequireAuth(), async (req, res, next) => {
    //get clerk user id from request
    const clerkUserId = req.auth.userId;
    //getting request body stats
    const { 
        minutesRead = 0, 
        passagesRead = 0, 
        correctAnswersThisExercise = 0,     
        totalQuestionsThisExercise = 0, 
        difficultWords = [],
        totalWords = 0,
        readingTimeSeconds = 0, 
        exerciseType = 'daily' 
    } = req.body;

    if (!clerkUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    //checking if we received the necessary comprehension data if questions were present
    if (totalQuestionsThisExercise > 0 && correctAnswersThisExercise === undefined) {
         console.warn(`Received totalQuestions=${totalQuestionsThisExercise} but no correctAnswersThisExercise for user ${clerkUserId}`);
    }

    try {
        let wordsPerMinute = 0;
        let calculatedReadingTimeSeconds = readingTimeSeconds; 
        const activeSession = await prisma.readingSession.findFirst({
            where: {
                clerkUserId,
                exerciseType,
                inProgress: true 
            },
            orderBy: { startTime: 'desc' } 
        });
        
        //if an active session exists, finalize it and use its calculated time/WPM
        if (activeSession) {
            const endTime = new Date();
            const startTime = new Date(activeSession.startTime);
            calculatedReadingTimeSeconds = Math.max(1, (endTime - startTime) / 1000);
            wordsPerMinute = Math.round((activeSession.wordCount / calculatedReadingTimeSeconds) * 60);
            await prisma.readingSession.update({
                where: {
                    id: activeSession.id
                },
                data: {
                    endTime,
                    readingTimeSeconds: calculatedReadingTimeSeconds,
                    wordsPerMinute,
                    inProgress: false
                }
            });
            console.log(`Finalized active session ${activeSession.id} within exercise-complete.`);
        } else if (calculatedReadingTimeSeconds > 0 && totalWords > 0) {
            wordsPerMinute = Math.round((totalWords / calculatedReadingTimeSeconds) * 60);
            console.log(`Calculating WPM based on request body data: ${wordsPerMinute}`);
        }
        
        //get current user stats from database
        const currentStats = await prisma.userStats.findUnique({
            where: { clerkUserId: clerkUserId },
        });

        if (!currentStats) {
            return res.status(404).json({ error: 'User stats not found. Please fetch stats first.' });
        }

        let newStreak = 1;
        if (currentStats.lastActivity) {
            const streakUpdate = calculateStreak(currentStats.lastActivity);
            if (streakUpdate.reset) {
                newStreak = 1;
            } else if (streakUpdate.increment > 0) {
                newStreak = currentStats.streak + 1;
            } else {
                newStreak = currentStats.streak;
            }
        }
        newStreak = Math.max(1, newStreak);

        let difficultWordPercentage = 0;
        if (totalWords > 0 && difficultWords.length > 0) {
            difficultWordPercentage = (difficultWords.length / totalWords) * 100;
        }
        
        //calculating the comprehension score for this exercise
        const currentExerciseComprehensionScore = totalQuestionsThisExercise > 0 
            ? Math.round((correctAnswersThisExercise / totalQuestionsThisExercise) * 100) 
            : 0;

        //preparing exercise data
        const exerciseData = {
            clerkUserId: clerkUserId,
            type: 'Daily Exercise',
            minutesRead: Math.ceil(calculatedReadingTimeSeconds / 60),
            passagesRead: passagesRead,
            difficultWords: difficultWords.join(','),
            difficultWordPercentage: difficultWordPercentage,
            totalWords: totalWords,
            comprehensionScore: currentExerciseComprehensionScore,
            readingTimeSeconds: calculatedReadingTimeSeconds,
            wordsPerMinute: wordsPerMinute
        };

        //storing the individual exercise data
        let exerciseCreated = false;
        try {
            await prisma.exercise.create({ data: exerciseData }); //creating the exercise
            exerciseCreated = true;
        } catch (exerciseError) {
            console.error(`Error recording exercise for user ${clerkUserId}:`, exerciseError);
        }
        
        //incrementing total comprehension stats
        const newTotalCorrectAnswers = currentStats.totalCorrectComprehensionAnswers + correctAnswersThisExercise; 
        const newTotalQuestions = currentStats.totalComprehensionQuestions + totalQuestionsThisExercise;
        
        //calculating the new overall average comprehension score
        const newAverageComprehensionScore = newTotalQuestions > 0 
            ? Math.round((newTotalCorrectAnswers / newTotalQuestions) * 100) 
            : 0; //avoiding division by 0

        //incrementing exercises completed only if actual reading/comprehension happened
        const exercisesIncrement = 1;
        
        //calculating updated average WPM
        let newAverageWPM = currentStats.averageWPM;
        if (wordsPerMinute > 0) {
            const completedSessions = await prisma.readingSession.findMany({
                where: { 
                    clerkUserId, 
                    inProgress: false,
                    wordsPerMinute: { not: null }
                }
            });
            
            let totalWPM = completedSessions.reduce((sum, session) => sum + (session.wordsPerMinute || 0), 0);
            const currentSessionWPM = wordsPerMinute; 
            totalWPM += currentSessionWPM;
            newAverageWPM = Math.round(totalWPM / (completedSessions.length + 1));
        }
        
        const updatedStats = await prisma.userStats.update({
            where: { clerkUserId: clerkUserId },
            data: {
                totalReadingTime: { increment: Math.ceil(calculatedReadingTimeSeconds / 60) },
                totalPassagesRead: { increment: passagesRead },
                totalExercisesCompleted: { increment: exercisesIncrement },
                totalCorrectComprehensionAnswers: newTotalCorrectAnswers,
                totalComprehensionQuestions: newTotalQuestions, 
                averageComprehensionScore: newAverageComprehensionScore,
                lastSessionDuration: Math.ceil(calculatedReadingTimeSeconds / 60),
                lastDifficultWordPercentage: difficultWordPercentage,
                averageWPM: newAverageWPM,
                streak: newStreak,
                lastActivity: new Date(),
                updatedAt: new Date(),
            },
        });
        
        //automatic leveling up logic
        let finalStats = updatedStats;
        const LEVEL_UP_THRESHOLD = 5; //number of consecutive perfect exercises to level up (100% comprehension score and 5% difficult word percentage)
        
        if (updatedStats.readingLevel !== 'advanced') { //only level up if not already advanced
            const recentExercises = await prisma.exercise.findMany({ //getting the recent exercises
                where: { clerkUserId: clerkUserId },
                orderBy: { completedAt: 'desc' },
                take: LEVEL_UP_THRESHOLD,
            });
            
            if (recentExercises.length === LEVEL_UP_THRESHOLD) { //if we have enough exercises
                const allPerfect = recentExercises.every( //checking if all exercises are perfect
                    ex => ex.comprehensionScore === 100 && ex.difficultWordPercentage <= 5 // Allow small margin for difficult words
                );
                
                if (allPerfect) { //if they're all perfect
                    let nextLevel = updatedStats.readingLevel; //getting the next level
                    if (updatedStats.readingLevel === 'beginner') { //if the user is beginner
                        nextLevel = 'intermediate'; //level up to intermediate
                    } else if (updatedStats.readingLevel === 'intermediate') { //if the user is intermediate
                        nextLevel = 'advanced'; //level up to advanced
                    }
                    
                    if (nextLevel !== updatedStats.readingLevel) { //if the user has leveled up
                        finalStats = await prisma.userStats.update({ //updating the user stats
                            where: { clerkUserId: clerkUserId },
                            data: { readingLevel: nextLevel },
                        });
                    }
                }
            }
        }
        res.json(finalStats); //returning the updated stats
    } catch (error) {
        console.error(`Error completing exercise for user ${clerkUserId}:`, error);
        next(error);
    }
});

//GET /api/user/exercises
//getting all past exercises for a user
router.get('/exercises', ClerkExpressRequireAuth(), async (req, res, next) => {
    const clerkUserId = req.auth.userId; //get the clerk user id from the request
    if (!clerkUserId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }
    try {
        //getting all exercises from the database
        const exercises = await prisma.exercise.findMany({
            where: { clerkUserId: clerkUserId },
            orderBy: { completedAt: 'desc' }
        });
        
        //processing the exercises to convert difficultWords back to array
        const processedExercises = exercises.map(exercise => ({
            ...exercise,
            difficultWords: exercise.difficultWords ? exercise.difficultWords.split(',') : []
        }));
        
        res.json(processedExercises);
    } catch (error) {
        console.error(`Error fetching exercises for user ${clerkUserId}:`, error);
        next(error);
    }
});

//POST /api/user/diagnostic-results
//storing diagnostic results
router.post('/diagnostic-results', ClerkExpressRequireAuth(), async (req, res, next) => {
    const clerkUserId = req.auth.userId; //get the clerk user id from the request
    const { 
        readingLevel,
        accuracyScore,
        comprehensionScore,
        speedScore
    } = req.body; //getting the request body stats
    
    if (!clerkUserId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }
    
    try {
        const userStats = await prisma.userStats.upsert({ //using upsert to prevent race conditions
            where: { clerkUserId: clerkUserId },
            update: {},
            create: {
                clerkUserId: clerkUserId,
                readingLevel: readingLevel || 'beginner',
            }
        });
        const diagnosticResult = await prisma.diagnosticResult.create({
            data: {
                clerkUserId,
                readingLevel,
                accuracyScore,
                comprehensionScore,
                speedScore
            }
        });
        res.json(diagnosticResult);
    } catch (error) {
        console.error(`Error storing diagnostic results for user ${clerkUserId}:`, error);
        next(error);
    }
});

//GET /api/user/diagnostic-results
//getting the most recent diagnostic result
router.get('/diagnostic-results', ClerkExpressRequireAuth(), async (req, res, next) => {
    const clerkUserId = req.auth.userId;
    if (!clerkUserId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }
    try {
        const diagnosticResults = await prisma.diagnosticResult.findMany({
            where: { clerkUserId: clerkUserId },
            orderBy: { completedAt: 'desc' },
            take: 1
        });
        if (diagnosticResults.length === 0) {
            return res.json(null);
        }
        res.json(diagnosticResults[0]);
    } catch (error) {
        console.error(`Error fetching diagnostic results for user ${clerkUserId}:`, error);
        next(error);
    }
});

//POST /api/user/start-reading
//record the start time when a user begins reading
router.post('/start-reading', ClerkExpressRequireAuth(), async (req, res, next) => {
  const clerkUserId = req.auth.userId;
  const { exerciseType, wordCount } = req.body;

  if (!clerkUserId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    await prisma.userStats.upsert({
      where: { clerkUserId },
      update: {}, 
      create: {
        clerkUserId,
        readingLevel: 'beginner',
        streak: 1,
        lastActivity: new Date()
      }
    });
    let existingSession = await prisma.readingSession.findFirst({
      where: {
        clerkUserId,
        exerciseType,
        inProgress: true
      },
      orderBy: {
        startTime: 'desc'
      }
    });

    let readingSession;
    const now = new Date();

    if (existingSession) {
      //if an active session exists update it
      readingSession = await prisma.readingSession.update({
        where: { id: existingSession.id },
        //updating the session with new start time and clearing previous end time, reading time, and WPM
        data: {
          startTime: now,
          wordCount: wordCount || 0,
          inProgress: true, 
          endTime: null, 
          readingTimeSeconds: null, 
          wordsPerMinute: null 
        }
      });
    } else {
      readingSession = await prisma.readingSession.create({
        data: {
          clerkUserId,
          exerciseType,
          startTime: now,
          wordCount: wordCount || 0,
          inProgress: true
        }
      });
    }
    res.json({ success: true, sessionId: readingSession.id }); //returning session id
  } catch (error) {
    console.error(`Error starting reading session for user ${clerkUserId}:`, error);
    next(error);
  }
});

//POST /api/user/finish-reading
//record the end time when a user finishes reading and calculate metrics
router.post('/finish-reading', ClerkExpressRequireAuth(), async (req, res, next) => {
  const clerkUserId = req.auth.userId;
  const { exerciseType } = req.body;

  if (!clerkUserId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    await prisma.userStats.upsert({
      where: { clerkUserId },
      update: {},
      create: {
        clerkUserId,
        readingLevel: 'beginner',
        streak: 1,
        lastActivity: new Date()
      }
    });
    const readingSession = await prisma.readingSession.findFirst({
      where: {
        clerkUserId,
        exerciseType,
        inProgress: true 
      },
      orderBy: {
        startTime: 'desc' 
      }
    });

    if (!readingSession) { 
      return res.status(200).json({ success: true, message: 'No active session found to finish.' });
    }

    //calculating reading time and WPM
    const endTime = new Date();
    const startTime = new Date(readingSession.startTime);
    const readingTimeSeconds = Math.max(1, (endTime - startTime) / 1000);
    const wordsPerMinute = readingSession.wordCount > 0 
      ? Math.round((readingSession.wordCount / readingTimeSeconds) * 60)
      : 0;
    const updatedSession = await prisma.readingSession.update({
      where: {
        id: readingSession.id
      },
      data: {
        endTime,
        readingTimeSeconds,
        wordsPerMinute,
        inProgress: false
      }
    });
    res.json({
      success: true,
      readingTimeSeconds,
      wordsPerMinute,
      sessionId: updatedSession.id
    });
  } catch (error) {
    console.error(`Error finishing reading session for user ${clerkUserId}:`, error);
    next(error);
  }
});

//GET /api/user/reading-stats
//get reading statistics for a user
router.get('/reading-stats', ClerkExpressRequireAuth(), async (req, res, next) => {
  const clerkUserId = req.auth.userId;

  if (!clerkUserId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    //getting all completed reading sessions
    const readingSessions = await prisma.readingSession.findMany({
      where: { 
        clerkUserId,
        inProgress: false 
      },
      orderBy: { endTime: 'desc' }
    });

    //avg WPM and total reading time
    let totalWPM = 0;
    let totalReadingTime = 0;
    readingSessions.forEach(session => {
      if (session.wordsPerMinute) {
        totalWPM += session.wordsPerMinute;
      }
      if (session.readingTimeSeconds) {
        totalReadingTime += session.readingTimeSeconds;
      }
    });
    const averageWPM = readingSessions.length > 0 ? Math.round(totalWPM / readingSessions.length) : 0;
    res.json({
      sessions: readingSessions,
      averageWPM,
      totalReadingTimeSeconds: totalReadingTime,
      totalReadingTimeMinutes: Math.round(totalReadingTime / 60),
      sessionCount: readingSessions.length
    });
  } catch (error) {
    console.error(`Error fetching reading stats for user ${clerkUserId}:`, error);
    next(error);
  }
});

module.exports = router; 