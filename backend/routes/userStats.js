const express = require('express');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = express.Router();

//helper function for streak calculation
function calculateStreak(lastActivity) {
  if (!lastActivity) {
    return 1; 
  }
  //get the current date
  const now = new Date();
  //get the current date in milliseconds
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  //get the last activity date in milliseconds
  const lastActivityDate = new Date(lastActivity).getTime();
  //get the date of yesterday in milliseconds
  const yesterday = today - 86400000; //ms in a day

  //if the last activity date was yesterday, increment the streak
  if (lastActivityDate === yesterday) {
    return { increment: 1, reset: false }; //increment streak
  } else if (lastActivityDate < yesterday) { //if it was before yesterday reset the streak
    return { increment: 0, reset: true }; //reset streak to 1
  }
  //if lastActivity is today, streak doesn't change
  return { increment: 0, reset: false }; 
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
        },
      });
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
  //get the difficulty level from the request body
  const { difficultyLevel } = req.body;

  if (!clerkUserId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }
  if (!difficultyLevel) {
    return res.status(400).json({ error: 'Missing difficultyLevel in request body' });
  }

  try {
    //get the current user stats from the database
    const currentStats = await prisma.userStats.findUnique({
        where: { clerkUserId: clerkUserId },
    });

    //if stats don't exist return error
    if (!currentStats) {
        return res.status(404).json({ error: 'User stats not found. Please fetch stats first.' });
    }

    //calculate streak update
    const streakUpdate = calculateStreak(currentStats.lastActivity);
    let newStreak = currentStats.streak;
    if (streakUpdate.reset) {
        newStreak = 1;
    } else if (streakUpdate.increment > 0) {
        newStreak += streakUpdate.increment;
    }

    //update user stats
    const updatedStats = await prisma.userStats.update({
      where: { clerkUserId: clerkUserId },
      data: {
        readingLevel: difficultyLevel,
        totalReadingTime: { increment: 5 }, //estimated diagnostic time for reading time
        progress: { increment: 5 },       //adding small progress boost
        streak: newStreak,                  //new streak
        lastActivity: new Date(),         //updating last activity timestamp
        updatedAt: new Date(),            
      },
    });
    console.log(`Updated stats for user ${clerkUserId} after diagnostic.`);
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
        correctAnswers = 0, 
        totalQuestions = 0,
        difficultWords = [],
        totalWords = 0
    } = req.body;

    if (!clerkUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
        //get current user stats from database
        const currentStats = await prisma.userStats.findUnique({
            where: { clerkUserId: clerkUserId },
        });

        if (!currentStats) {
            return res.status(404).json({ error: 'User stats not found. Please fetch stats first.' });
        }

        //calculate streak update
        const streakUpdate = calculateStreak(currentStats.lastActivity);
        let newStreak = currentStats.streak;
        if (streakUpdate.reset) {
            newStreak = 1;
        } else if (streakUpdate.increment > 0) {
            newStreak += streakUpdate.increment;
        }
        //increment exercises completed if questions were answered
        const exercisesIncrement = totalQuestions > 0 ? 1 : 0; 
        //calculate difficult words percentage for this exercise
        let difficultWordPercentage = 0;
        if (totalWords > 0 && difficultWords.length > 0) {
            difficultWordPercentage = (difficultWords.length / totalWords) * 100;
        }
        //update user stats
        const updatedStats = await prisma.userStats.update({
            where: { clerkUserId: clerkUserId },
            data: {
                totalReadingTime: { increment: minutesRead },
                totalPassagesRead: { increment: passagesRead },
                totalExercisesCompleted: { increment: exercisesIncrement },
                correctAnswers: { increment: correctAnswers },
                totalQuestions: { increment: totalQuestions },
                lastSessionDuration: minutesRead,
                lastDifficultWordPercentage: difficultWordPercentage,
                streak: newStreak,
                lastActivity: new Date(),
                updatedAt: new Date(),
            },
        });
        //return updated stats
        res.json(updatedStats);
    } catch (error) {
        console.error(`Error updating exercise results for user ${clerkUserId}:`, error);
        next(error);
    }
});


module.exports = router; 