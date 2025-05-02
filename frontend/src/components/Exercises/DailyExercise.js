import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import './DailyExercise.css';
import Navbar from '../Navbar';
import useTextToSpeech from '../../hooks/useTextToSpeech';
import { getApiUrl } from '../../config'; // Adjusted path

function DailyExercise() {
  const [stage, setStage] = useState('intro'); //stages possible: intro, loading, reading, wordSelection, comprehension, error, completed
  const [originalPassage, setOriginalPassage] = useState(''); //getting original passage
  const [simplifiedPassage, setSimplifiedPassage] = useState(''); //geting simplified passage
  const [dataSimplifiedPassage, setDataSimplifiedPassage] = useState(''); //getting data simplified passage
  const [error, setError] = useState(null); //error state
  const [wordCount, setWordCount] = useState(0); //word count state
  const [selectedWords, setSelectedWords] = useState([]); //selected words state
  const [wordSelectionDone, setWordSelectionDone] = useState(false); //word selection done state
  const [comprehensionText, setComprehensionText] = useState(''); // comprehension text
  const [comprehensionQuestions, setComprehensionQuestions] = useState([]); // comprehension questions
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0); // current question index
  const [selectedAnswers, setSelectedAnswers] = useState({}); // selected answers
  const [comprehensionScore, setComprehensionScore] = useState(0); // comprehension score
  const [showComprehension, setShowComprehension] = useState(false); // whether to show comprehension questions
  const [readingStartTime, setReadingStartTime] = useState(null); // track when reading starts
  const [readingTimeSeconds, setReadingTimeSeconds] = useState(0); // reading time in seconds
  const [wordsPerMinute, setWordsPerMinute] = useState(0); // words per minute
  const [difficultyLevel, setDifficultyLevel] = useState('intermediate'); // default to intermediate
  const { speak, cancel, isSpeaking, isSupported } = useTextToSpeech();
  const navigate = useNavigate(); //navigation hook
  const { getToken } = useAuth(); //get token from auth hook

  //fetching user's reading level when component mounts
  useEffect(() => {
    const fetchUserReadingLevel = async () => {
      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Authentication token not available.");
        }
        const response = await fetch(getApiUrl('/api/user/diagnostic-results'), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.readingLevel) {
            setDifficultyLevel(data.readingLevel);
          }
        }
      } catch (error) {
        console.error('Error fetching user reading level:', error);
      }
    };
    
    fetchUserReadingLevel();
  }, [getToken]);

  //start tracking reading time
  const startReadingTimer = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication token not available.");
      }
      const response = await fetch(getApiUrl('/api/user/start-reading'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          exerciseType: 'daily',
          wordCount: wordCount
        })
      });
      
      if (!response.ok) {
        console.error('Error starting reading timer:', response.statusText);
        return;
      }
      await response.json();
      setReadingStartTime(Date.now());
    } catch (error) {
      console.error('Error starting reading timer:', error);
    }
  }, [getToken, wordCount]);

  //end tracking reading time
  const endReadingTimer = useCallback(async () => {
    if (!readingStartTime) return; //if no reading start time, return
    const endTime = Date.now(); //end time is now
    const timeSpentReading = Math.max(1, (endTime - readingStartTime) / 1000); //calculate time spent
    setReadingTimeSeconds(timeSpentReading); //set reading time seconds
    //calculating WPM
    if (wordCount > 0) {
      const wpm = Math.round((wordCount / timeSpentReading) * 60);
      setWordsPerMinute(wpm);
    }
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication token not available.");
      }
      const response = await fetch(getApiUrl('/api/user/finish-reading'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          exerciseType: 'daily'
        })
      });
      
      if (!response.ok) {
        console.error('Error ending reading timer:', response.statusText);
        return;
      }
      const data = await response.json();
    } catch (error) {
      console.error('Error ending reading timer:', error);
    }
  }, [getToken, readingStartTime, wordCount]);

  //memoized fetchPassage function (avoiding infinite loops)
  const fetchPassage = useCallback(async () => {
    try {
      // Reset the exerciseCompleted flag when starting a new exercise
      window.exerciseCompleted = false;
      
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication token not available.");
      }
      //preventing multiple fetches if already loading
      if (stage === 'loading') {
        return;
      }
      setStage('loading'); //setting loading state while fetching
      const params = new URLSearchParams(); //creating params object
      //only send min_words, backend determines level and simplification
      params.append('min_words', '10'); 
      const queryString = params.toString() ? `?${params.toString()}` : ''; //query string
      //fetching from the backend the passage
      const response = await fetch(getApiUrl(`/api/exercises/daily${queryString}`), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`No passages found with at least 10 words.`);
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      }
      //getting the data from the response
      const data = await response.json();
      setOriginalPassage(data.original_text); //setting original passage
      setSimplifiedPassage(data.simplified_text); //setting simplified passage
      setWordCount(data.word_count || 0); //setting word count
      //handling data_simplified_text field when using custom simplifier
      if (data.data_simplified_text) {
        setDataSimplifiedPassage(data.data_simplified_text);
      }
      setStage('reading'); //set stage to reading on successful fetch
      setShowComprehension(true); //set showComprehension to true after successful fetch
      //start the reading timer when content is loaded
      startReadingTimer();
    } catch (error) {
      console.error('Error fetching passage:', error);
      setError(error.message || 'Could not load the exercise. Please try again later.');
      setStage('error'); 
    }
  }, [getToken, stage, startReadingTimer]);

  //fetching comprehension exercise
  const fetchComprehensionExercise = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication token not available.");
      }
      //fetching from the backend the comprehension exercise
      const response = await fetch(getApiUrl('/api/exercises/daily-comprehension'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setComprehensionText(data.text);
      setComprehensionQuestions(data.questions);
      setCurrentQuestionIndex(0);
      setSelectedAnswers({});
      setComprehensionScore(0);
      setShowComprehension(true);
      
    } catch (error) {
      console.error('Error fetching comprehension exercise:', error);
      setShowComprehension(false);
      setStage('completed'); 
    }
  }, [getToken]);
  
  //only fetch a passage on initial mount or when explicitly requested
  useEffect(() => {
    if (stage === 'intro' || stage === 'loading') {
      return;
    }
    fetchPassage();
  }, []); 

  //toggle word function
  const toggleWord = (word) => {
    setSelectedWords(prev =>
      prev.includes(word)
        ? prev.filter(w => w !== word)
        : [...prev, word]
    );
  };

  //handle answer selection
  const handleAnswerSelect = (questionIndex, optionIndex) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionIndex]: optionIndex
    }));
  };

  //handle next question
  const handleNextQuestion = () => {
    cancel(); 
    if (currentQuestionIndex < comprehensionQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      //calculating score for this exercise
      let correctCount = 0;
      comprehensionQuestions.forEach((question, index) => {
        if (selectedAnswers[index] === question.correctOptionIndex) {
          correctCount++;
        }
      });
      const totalQuestions = comprehensionQuestions.length;
      const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
      setComprehensionScore(score); 
      saveExerciseResults(correctCount, totalQuestions);
      setStage('completed');
    }
  };


  //save exercise results
  const saveExerciseResults = async (correctCount, totalQuestionsCount) => {
    if (window.savingExercise || window.exerciseCompleted) {
        return; 
    }
    window.savingExercise = true; 
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication token not available.");
      }
      //calculating minutes read based on word count -> calculated as readingTimeSeconds / 60 or passageWordCount / 200
      const passageWordCount = simplifiedPassage.split(/\s+/).length;
      const minutesRead = Math.ceil(readingTimeSeconds / 60) || Math.max(1, Math.round(passageWordCount / 200));
      const requestBody = {
        minutesRead,
        passagesRead: 1,
        difficultWords: selectedWords,
        totalWords: passageWordCount,
        correctAnswersThisExercise: correctCount,
        totalQuestionsThisExercise: totalQuestionsCount,
        readingTimeSeconds: readingTimeSeconds,
        exerciseType: 'daily'
      };
      const response = await fetch(getApiUrl('/api/user/exercise-complete'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error response:', errorData);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error || 'Unknown error'}`);
      }
      window.exerciseCompleted = true; 
    } catch (error) {
      console.error('Error completing exercise:', error);
      setError('Could not save exercise results. Please try refreshing.');
    } finally {
       window.savingExercise = false; 
    }
  };

  //handle complete
  const handleComplete = async () => {
    cancel(); 
    if (!wordSelectionDone) {
      //end the reading timer
      endReadingTimer();
      setWordSelectionDone(true);
      setStage('wordSelection');
      return;
    }
    
    //this part now runs after the user clicks theyre done on the word selection screen
    if (stage === 'wordSelection') {
        cancel(); 
        if (showComprehension) {
            fetchComprehensionExercise(); //get comprehension exrecise
            setStage('comprehension'); //move to comprehension stage
        } else {
            cancel(); 
            saveExerciseResults(0, 0); 
            setStage('completed'); 
        }
        return; 
    }
  };

  //handle going back to the dashbaord
  const handleBackToDashboard = () => {
    cancel(); 
    navigate('/dashboard');
  };

  //cancel speech on stage change or unmount
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [stage, cancel]);
  //cancel speech on comprehension question change
  useEffect(() => {
    if (stage === 'comprehension') {
        cancel();
    }
  }, [currentQuestionIndex, stage, cancel]);

  //handle listening to reading
  const handleListenReading = () => {
    if (!isSupported) return alert("Sorry, your browser doesn't support text-to-speech.");
    if (isSpeaking) {
      cancel();
    } else {
      const instructions = "Read through the passage.";
      const passage = simplifiedPassage || dataSimplifiedPassage || originalPassage;
      const textToSpeak = `${instructions} ${passage}`;
      speak(textToSpeak);
    }
  };
  
  //handle listening to word selection
  const handleListenWordSelection = () => {
      if (!isSupported) return alert("Sorry, your browser doesn't support text-to-speech.");
      if (isSpeaking) {
          cancel();
      } else {
          const instructions = "Select any words you found difficult to understand.";
          const passage = simplifiedPassage || dataSimplifiedPassage || originalPassage;
          const textToSpeak = `${instructions} ${passage}`;
          speak(textToSpeak);
      }
  };
  
  //handle listening to comprehension
  const handleListenComprehension = () => {
      if (!isSupported || !comprehensionQuestions || comprehensionQuestions.length === 0) return;
      if (isSpeaking) {
          cancel();
      } else {
          const instructionText = "Read the passage and answer comprehension questions.";
          const questionData = comprehensionQuestions[currentQuestionIndex];
          const questionText = `${currentQuestionIndex + 1}. ${questionData.question}`;
          const optionsText = questionData.options
                                    .map((opt) => `${opt.displayId}. ${opt.text}`)
                                    .join('. ');
          const textToSpeak = `${instructionText} ${comprehensionText ? comprehensionText + ". " : ""}${questionText} ${optionsText}`;
          speak(textToSpeak);
      }
  };

  if (stage === 'intro') {
    return (
      <div className="diagnostic-container daily-exercise-intro">
        <div className="header">
          <div className="logo" onClick={() => navigate('/')}>read<span className="accent">able</span></div>
          <div className="nav-buttons">
             <button className="results-button" onClick={() => navigate('/dashboard')}>Dashboard</button>
          </div>
        </div>
        <div className="content">
          <h1>Daily Exercise</h1>
          <p className="description">
            Ready for your daily practice? You'll be asked to do a series of
            exercises to help you improve your reading skills.
          </p>
          <button 
            className="start-exercise-button" 
            onClick={() => {
                setStage('loading');
                fetchPassage();  
            }}
          >
            Start Exercise <span className="arrow">→</span>
          </button>
        </div>
      </div>
    );
  }
  if (stage === 'loading') {
    return (
      <div className="exercise-container">
        <div className="header">
          <div className="logo" onClick={() => navigate('/')}>read<span className="accent">able</span></div>
          <div className="nav-buttons">
            <button className="results-button" onClick={() => navigate('/dashboard')}>Dashboard</button>
          </div>
        </div>
        <div className="exercise-content">
          <div className="loading">
            <p>Loading your personalized exercise...</p>
          </div>
        </div>
      </div>
    );
  }
  if (stage === 'error') {
    return (
      <div className="exercise-container">
        <div className="header">
          <div className="logo" onClick={() => navigate('/')}>read<span className="accent">able</span></div>
          <div className="nav-buttons">
            <button className="results-button" onClick={() => navigate('/dashboard')}>Dashboard</button>
          </div>
        </div>
        <div className="exercise-content">
          <div className="error-message">
            <h2>Something went wrong - try going back to the dashboard and starting again in a minute!</h2>
            <p>{error}</p>
            <button 
              className="back-to-dashboard-button" 
              onClick={handleBackToDashboard}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (stage === 'wordSelection') {
    const passageForWordSelection = simplifiedPassage || dataSimplifiedPassage || originalPassage;
    return (
      <div className="exercise-container">
        <div className="header">
          <div className="logo" onClick={() => navigate('/')}>read<span className="accent">able</span></div>
          <div className="nav-buttons">
            <button className="results-button" onClick={() => navigate('/dashboard')}>Dashboard</button>
          </div>
        </div>
        <div className="exercise-content">
          <div className="step-wrapper">
            <div className="step active">2</div>
            <span className="step-text">Select any words you found difficult to understand.</span>
          </div>
          
          <div className={`text-container ${difficultyLevel}-text`}>
            {passageForWordSelection.split(/\s+/).map((word, idx) => {
              const cleanWord = word.replace(/[.,;:!?()"']/g, '');
              return (
                <span
                  key={idx}
                  className={`word ${selectedWords.includes(cleanWord) ? 'selected' : ''}`}
                  onClick={() => toggleWord(cleanWord)}
                >
                  {word}
                </span>
              );
            })}
          </div>

          <div className="actions">
            <button 
              className={`listen-button ${isSpeaking ? 'speaking' : ''}`} 
              onClick={handleListenWordSelection} 
              disabled={!isSupported}
            >
              <span className="listen-icon">{isSpeaking ? '⏹️' : '🔊'}</span> 
              {isSpeaking ? 'Stop' : 'Listen'}
            </button>
            <button className="complete-button" onClick={handleComplete}> 
              I'm Done <span className="arrow">→</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (stage === 'comprehension') {
    return (
      <div className="exercise-container">
        <Navbar />
        <div className="exercise-content">
          <div className="step-wrapper">
            <div className="step active">3</div>
            <span className="step-text">Read the passage and answer comprehension questions.</span>
          </div>
          
          {comprehensionText && (
            <div className="passage-container">
              <div className={`passage-text ${difficultyLevel}-text`}>{comprehensionText}</div>
            </div>
          )}
          
          {comprehensionQuestions.length > 0 && (
            <div className="questions-container">
              <div className="question">
                <h3 className={`${difficultyLevel}-text`}>{currentQuestionIndex + 1}. {comprehensionQuestions[currentQuestionIndex].question}</h3>
                
                <div className="options">
                  {comprehensionQuestions[currentQuestionIndex].options.map((option, index) => (
                    <div 
                      key={index}
                      className={`option ${selectedAnswers[currentQuestionIndex] === index ? 'selected' : ''} ${difficultyLevel}-text`}
                      onClick={() => handleAnswerSelect(currentQuestionIndex, index)}
                    >
                      {option.displayId}. {option.text}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="actions">
                <button 
                  className={`listen-comprehension-button ${isSpeaking ? 'speaking' : ''}`} 
                  onClick={handleListenComprehension} 
                  disabled={!isSupported}
                  title={isSpeaking ? 'Stop speaking' : 'Listen to passage, question, and options'}
                >
                  <span className="listen-icon">{isSpeaking ? '⏹️' : '🔊'}</span>
                  {isSpeaking ? 'Stop' : 'Listen'}
                </button>
                <button 
                  className="complete-button"
                  onClick={handleNextQuestion}
                  disabled={selectedAnswers[currentQuestionIndex] === undefined}
                >
                  {currentQuestionIndex < comprehensionQuestions.length - 1 ? "Next Question" : "Finish"} <span className="arrow">→</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (stage === 'completed') { 
    return (
      <div className="exercise-container">
        <Navbar />
        <div className="exercise-content">
          <div className="completion-message">
            <h2>Great job!</h2>
            <p>You've completed today's reading exercise. Here's your review:</p>
            
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">⏱️</div>
                <div className="stat-title">Reading Time</div>
                <div className="stat-value">{Math.round(readingTimeSeconds)} seconds</div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">📊</div>
                <div className="stat-title">Reading Speed</div>
                <div className="stat-value">{wordsPerMinute} WPM</div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">📚</div>
                <div className="stat-title">Difficult Words</div>
                <div className="stat-value">{selectedWords.length}</div>
              </div>
              
              {showComprehension && (
                <div className="stat-card">
                  <div className="stat-icon">🧠</div>
                  <div className="stat-title">Comprehension</div>
                  <div className="stat-value">{comprehensionScore}%</div>
                </div>
              )}
            </div>
            
            <button 
              className="back-to-dashboard-button"
              onClick={handleBackToDashboard}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const passageToShow = simplifiedPassage || dataSimplifiedPassage || originalPassage;
  return (
    <div className="exercise-container">
      <Navbar />
      <div className="exercise-content">
        <div className="step-wrapper">
           <div className="step active">1</div>
           <span className="step-text">Read through the passage. Click "Done" when finished.</span>
        </div>

        <div className="passage-container">
          <div className={`passage-text ${difficultyLevel}-text`}>{passageToShow}</div>
        </div>

        <div className="actions">
          <button 
            className={`listen-button ${isSpeaking ? 'speaking' : ''}`} 
            onClick={handleListenReading} 
            disabled={!isSupported}
          >
            <span className="listen-icon">{isSpeaking ? '⏹️' : '🔊'}</span> 
            {isSpeaking ? 'Stop' : 'Listen'}
          </button>
          <button className="complete-button" onClick={handleComplete}>
            Done <span className="arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default DailyExercise; 