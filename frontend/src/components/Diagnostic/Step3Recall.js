import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
import './Step3Recall.css';
import filledShape from '../../filled-shape.svg';
import useTextToSpeech from '../../hooks/useTextToSpeech';
import { getApiUrl } from '../../config'; // Adjusted path

function Step3Recall() {
  const [stage, setStage] = useState('intro'); //stages are intro, flashcards, test, completed
  const [selectedWords, setSelectedWords] = useState([]); //selected words from test
  const [difficultyLevel, setDifficultyLevel] = useState(null);
  const navigate = useNavigate(); //navigation to other pages
  const { user } = useUser(); //user from clerk
  const { getToken } = useAuth(); //getting auth token
  const { speak, cancel, isSpeaking, isSupported } = useTextToSpeech(); //text-to-speech

  const correctRecallWords = ['House', 'Goose', 'Thimble']; // words that weren't in the original set
  //words for the flashcards
  const flashcardWords = ["Horse", "Knight", "Ghost", "Elephant", "Friend", "Whistle"];
  //words for the test (some same, some different)
  const testWords = ["House", "Knight", "Goose", "Elephant", "Friend", "Thimble"];

  //cancel speech on stage change or unmount
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [stage, cancel]);

  //handling start exercise
  const handleStartExercise = () => {
    cancel();
    setStage('flashcards');
  };

  //function to calculate difficulty level based on all tests
  const calculateDifficultyLevel = () => {
    const diagnosticData = JSON.parse(sessionStorage.getItem('diagnosticData') || '{}');
    const { difficultWords = [], totalWords = 0, comprehensionAnswers = {} } = diagnosticData;
    let difficultyScores = [];
    //calculating difficulty from word test (percentage of difficult words)
    const difficultWordPercent = totalWords > 0 
      ? (difficultWords.length / totalWords) * 100  //if total words is greater than 0, calculate difficult word percent
      : 0; //if total words is 0, set difficult word percent to 0
    
    //if difficult word percent is greater than 30, push beginner to difficulty scores
    //if difficult word percent is between 10 and 20, push intermediate to difficulty scores
    //otherwise, push advanced to difficulty scores
    if (difficultWordPercent > 30) {
      difficultyScores.push('beginner');
    } else if (difficultWordPercent >= 10 && difficultWordPercent <= 20) {
      difficultyScores.push('intermediate');
    } else {
      difficultyScores.push('advanced');
    }
    
    //calculate difficulty from comprehension test
    const correctAnswers = Object.values(comprehensionAnswers)
      .filter(answer => answer === 'A')
      .length;
    if (correctAnswers === 0 || correctAnswers === 1) { //if they got 0 or 1 right, push beginner to difficulty scores
      difficultyScores.push('beginner');
    } else if (correctAnswers === 2) {  //if they got 2 right, push intermediate to difficulty scores
      difficultyScores.push('intermediate');
    } else if (correctAnswers === 3) { //if they got 3 right, push advanced 
      difficultyScores.push('advanced');
    } else {
      difficultyScores.push('beginner');
    }
    
    //calculating difficulty from recall test
    const incorrectRecallCount = correctRecallWords.length - 
      selectedWords.filter(word => 
        correctRecallWords.includes(word)).length;
    //if they got more than 2 wrong, push beginner to difficulty scores
    //if they got 1 wrong, push intermediate to difficulty scores
    //otherwise, push advanced to difficulty scores
    if (incorrectRecallCount > 2) {
      difficultyScores.push('beginner');
    } else if (incorrectRecallCount === 1) {
      difficultyScores.push('intermediate');
    } else {
      difficultyScores.push('advanced');
    }
    
    //determining final level based on equal weighting
    const countBeginner = difficultyScores.filter(level => level === 'beginner').length;
    const countIntermediate = difficultyScores.filter(level => level === 'intermediate').length;
    const countAdvanced = difficultyScores.filter(level => level === 'advanced').length;
    //if beginner is greater than intermediate and advanced, set final level to beginner
    let finalLevel;
    if (countBeginner >= countIntermediate && countBeginner >= countAdvanced) {
      finalLevel = 'beginner';
      //otherwise if intermediate is greater than beginner and advanced, set final level to intermediate
    } else if (countIntermediate >= countBeginner && countIntermediate >= countAdvanced) {
      finalLevel = 'intermediate';
    } else {
      finalLevel = 'advanced';
    }
    
    return finalLevel;
  };

  //handling next stage
  const handleNext = () => {
    cancel(); 
    if (stage === 'flashcards') {
      setStage('test');
    } else if (stage === 'test') {
      //storing selected recall words in sessionStorage
      const diagnosticData = JSON.parse(sessionStorage.getItem('diagnosticData') || '{}');
      sessionStorage.setItem('diagnosticData', JSON.stringify({
        ...diagnosticData,
        selectedRecallWords: selectedWords
      }));
      
      //calculating the final difficulty level
      const finalLevel = calculateDifficultyLevel();
      setDifficultyLevel(finalLevel);
      if (user) {
        user.update({
          unsafeMetadata: {
            ...user.unsafeMetadata,
            diagnosticCompleted: true,
            readingLevel: finalLevel,
            diagnosticCompletedAt: new Date().toISOString()
          }
        }).then(() => {
          console.log("User metadata updated with diagnostic results");
        }).catch(error => {
          console.error("Error updating user metadata:", error);
        });
      }
      
      //calling backend to update difficulty level
      const updateBackend = async () => {
        try {
          const token = await getToken();
          if (!token) {
            throw new Error("Authentication token not available.");
          }
          const diagnosticData = JSON.parse(sessionStorage.getItem('diagnosticData') || '{}');
          const { readingTimeSeconds = 0, totalWords = 0 } = diagnosticData;
          
          const response = await fetch(getApiUrl('/api/user/diagnostic-complete'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              difficultyLevel: finalLevel,
              readingTimeSeconds: readingTimeSeconds,
              totalWords: totalWords
            })
          });
          
          if (!response.ok) {
            throw new Error(`Failed to update difficulty level: ${response.status}`);
          }
          
          console.log('Updated user difficulty level:', finalLevel);
          
          //storing detailed diagnostic results for analysis
          const storeDiagnosticResults = async () => {
            try {
              const { difficultWords = [], totalWords = 0, comprehensionAnswers = {}, wordsPerMinute = 0 } = diagnosticData;
              const difficultWordsPercent = totalWords > 0 ? (difficultWords.length / totalWords) * 100 : 0;
              const wordAccuracy = 100 - difficultWordsPercent;
              
              //comprehension score = (correct answers / total questions) * 100
              const correctAnswersCount = Object.values(comprehensionAnswers)
                .filter(answer => answer === 'A')
                .length;
              const totalQuestions = Object.keys(comprehensionAnswers).length;
              const comprehension = totalQuestions > 0 
                ? (correctAnswersCount / totalQuestions) * 100 
                : 70;
              
              //speed score = (WPM - 50) / 250 * 100
              const speedScore = wordsPerMinute > 0 ? 
                Math.min(100, Math.max(0, ((wordsPerMinute - 50) / 250) * 100)) : 
                72; 
              const roundedWordAccuracy = Math.round(wordAccuracy);
              const roundedComprehension = Math.round(comprehension);
              const roundedSpeedScore = Math.round(speedScore);
              const response = await fetch(getApiUrl('/api/user/diagnostic-results'), {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  readingLevel: finalLevel,
                  accuracyScore: roundedWordAccuracy,
                  comprehensionScore: roundedComprehension,
                  speedScore: roundedSpeedScore
                })
              });
              
              if (!response.ok) {
                throw new Error(`Failed to store diagnostic results: ${response.status}`);
              }
              
              console.log('Diagnostic results stored successfully', {
                accuracyScore: roundedWordAccuracy,
                comprehensionScore: roundedComprehension,
                speedScore: roundedSpeedScore,
                readingTimeSeconds,
                wordsPerMinute
              });
            } catch (error) {
              console.error('Error storing diagnostic results:', error);
            }
          };
          
          storeDiagnosticResults();
        } catch (error) {
          console.error('Error in backend update:', error);
        }
      };
      updateBackend();
      setStage('completed');
    }
  };

  //handling word selection
  const handleWordSelect = (word) => {
    setSelectedWords(prev => 
      prev.includes(word) 
        ? prev.filter(w => w !== word) 
        : [...prev, word]
    );
  };

  //handling dashboard
  const handleDashboard = () => {
    cancel(); 
    navigate('/dashboard');
  };

  //handling listen flashcards
  const handleListenFlashcards = () => {
    if (!isSupported) return alert("Sorry, your browser doesn't support text-to-speech.");
    if (isSpeaking) {
      cancel();
    } else {
      const instructions = "Memorize the words on the flashcards.";
      const wordsToSpeak = flashcardWords.join(', ');
      const textToSpeak = `${instructions} ${wordsToSpeak}`;
      speak(textToSpeak);
    }
  };
  
  //handling listen to test
  const handleListenTest = () => {
    if (!isSupported) return alert("Sorry, your browser doesn't support text-to-speech.");
    if (isSpeaking) {
      cancel();
    } else {
      const instructions = "Select all the words you remember seeing on the flashcards.";
      const wordsToSpeak = testWords.join(', '); // Read the words presented in the test
      const textToSpeak = `${instructions} ${wordsToSpeak}`;
      speak(textToSpeak);
    }
  };

  if (stage === 'intro') {
    return (
      <div className="diagnostic-container">
        <div className="header">
          <div className="logo">read<span className="accent">able</span></div>
          <div className="nav-buttons">
            <button className="results-button" onClick={() => navigate('/dashboard')}>Dashboard</button>
          </div>
        </div>

        <div className="content">
          <div className="steps-row">
            <div className="step">1</div>
            <div className="step">2</div>
            <div className="step active">3</div>
          </div>

          <h1>Word Recall</h1>
          
          <p className="description">
            You will look through 6 flashcards with common words on them. You will then be
            tested on those words as well as some others that were not originally shown to
            you.
          </p>

          <button className="start-exercise-button" onClick={handleStartExercise}>
            Start Exercise <span className="arrow">→</span>
          </button>
        </div>

        <img src={filledShape} alt="" className="decorative-shape" />
      </div>
    );
  }
  if (stage === 'flashcards') {
    return (
      <div className="diagnostic-exercise-container">
        <div className="header">
          <div className="logo">read<span className="accent">able</span></div>
          <div className="nav-buttons">
            <button className="results-button" onClick={() => navigate('/dashboard')}>Dashboard</button>
          </div>
        </div>

        <div className="exercise-content">
          <div className="step-wrapper">
            <div className="step active">3</div>
            <span className="step-text">Memorize the words on the flashcards.</span>
          </div>
          
          <div className="flashcards-grid">
            {flashcardWords.map((word, index) => (
              <div key={index} className="flashcard">
                {word}
              </div>
            ))}
          </div>

          <div className="action-buttons">
            <button 
              className={`listen-button ${isSpeaking ? 'speaking' : ''}`} 
              onClick={handleListenFlashcards} 
              disabled={!isSupported}
            >
              <span className="listen-icon">{isSpeaking ? '⏹️' : '🔊'}</span> 
              {isSpeaking ? 'Stop' : 'Listen'}
            </button>
            <button className="next-button" onClick={handleNext}>
              Next <span className="arrow">→</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (stage === 'test') {
    return (
      <div className="diagnostic-exercise-container">
        <div className="header">
          <div className="logo">read<span className="accent">able</span></div>
          <div className="nav-buttons">
            <button className="results-button" onClick={() => navigate('/dashboard')}>Dashboard</button>
          </div>
        </div>

        <div className="exercise-content">
          <div className="step-wrapper">
            <div className="step active">3</div>
            <span className="step-text">Select all the words you remember seeing on the flashcards.</span>
          </div>
          
          <div className="test-words-grid">
            {testWords.map((word, index) => (
              <div 
                key={index} 
                className={`flashcard ${selectedWords.includes(word) ? 'selected' : ''}`}
                onClick={() => handleWordSelect(word)}
              >
                {word}
              </div>
            ))}
          </div>

          <div className="action-buttons">
            <button 
              className={`listen-button ${isSpeaking ? 'speaking' : ''}`} 
              onClick={handleListenTest} 
              disabled={!isSupported}
            >
              <span className="listen-icon">{isSpeaking ? '⏹️' : '🔊'}</span> 
              {isSpeaking ? 'Stop' : 'Listen'}
            </button>
            <button className="next-button" onClick={handleNext}>
              Finish <span className="arrow">→</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="diagnostic-container">
      <div className="header">
        <div className="logo">read<span className="accent">able</span></div>
        <div className="nav-buttons">
          <button className="results-button" onClick={() => navigate('/dashboard')}>Dashboard</button>
        </div>
      </div>

      <div className="content">
        <h1>All done!</h1>
        
        <p className="description">
          Your diagnostic results have been analyzed. Based on your performance, we've personalized
          the reading experience at the {difficultyLevel} level.
        </p>

        <button className="dashboard-button" onClick={handleDashboard}>
          Go to Dashboard <span className="arrow">→</span>
        </button>
      </div>

      <img src={filledShape} alt="" className="decorative-shape" />
    </div>
  );
}

export default Step3Recall;