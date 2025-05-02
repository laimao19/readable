import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './DiagnosticExercise.css';
import Navbar from '../Navbar';
import { useAuth } from '@clerk/clerk-react';
import useTextToSpeech from '../../hooks/useTextToSpeech';
import { getApiUrl } from '../../config';

const sampleText = "Speaking at the same meeting, Derrick Taff, a social scientist at Pennsylvania State University, described preliminary experiments which suggest that listening to recordings from national parks, of waterfalls, birdsong and wind, helped people recover from stressful events.";

function DiagnosticExercise() {
  const [selectedWords, setSelectedWords] = useState([]);
  const [readingStartTime, setReadingStartTime] = useState(null);
  const [readingTimeSeconds, setReadingTimeSeconds] = useState(0);
  const [wordsPerMinute, setWordsPerMinute] = useState(0);
  const { speak, cancel, isSpeaking, isSupported } = useTextToSpeech();
  const navigate = useNavigate();
  const { getToken } = useAuth();

  //start tracking reading time when component mounts
  const startReadingTimer = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication token not available.");
      }
      //start reading session
      const response = await fetch(getApiUrl('/api/user/start-reading'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          exerciseType: 'diagnostic',
          wordCount: sampleText.split(" ").length
        })
      });
      
      if (!response.ok) {
        console.error('Error starting reading timer:', response.statusText);
        return;
      }
      setReadingStartTime(Date.now());
    } catch (error) {
      console.error('Error starting reading timer:', error);
    }
  }, [getToken]);

  //end tracking reading time
  const endReadingTimer = useCallback(async () => {
    if (!readingStartTime) return; //if no reading start time then return
    const endTime = Date.now(); //end time is now
    const timeSpent = Math.max(1, (endTime - readingStartTime) / 1000); //calculate time spent
    setReadingTimeSeconds(timeSpent); //set reading time seconds
    
    //calculating WPM
    const totalWords = sampleText.split(" ").length;
    const wpm = Math.round((totalWords / timeSpent) * 60);
    setWordsPerMinute(wpm);
    
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication token not available.");
      }
      //finish reading session
      const response = await fetch(getApiUrl('/api/user/finish-reading'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          exerciseType: 'diagnostic'
        })
      });
      
      if (!response.ok) {
        console.error('Error ending reading timer:', response.statusText);
        return {
          readingTimeSeconds: timeSpent,
          wordsPerMinute: wpm
        };
      }      
      await response.json(); 
      return {
        readingTimeSeconds: timeSpent,
        wordsPerMinute: wpm
      };
    } catch (error) {
      console.error('Error ending reading timer:', error);
      return {
        readingTimeSeconds: timeSpent,
        wordsPerMinute: wpm
      };
    }
  }, [getToken, readingStartTime]);

  //useeffect to start and stop reading timer
  useEffect(() => {
    //start the timer when the component mounts
    startReadingTimer();
    //cleaning up timer if component unmounts
    return () => {
      if (readingStartTime) { //if reading start time exists
        endReadingTimer();
      }
    };
  }, [startReadingTimer, endReadingTimer, readingStartTime]);

  //toggle word -> if word is already selected, remove it, otherwise add it
  const toggleWord = (word) => {
    setSelectedWords(prev =>
      prev.includes(word)
        ? prev.filter(w => w !== word)
        : [...prev, word]
    );
  };

  //text-to-speech functionality
  const handleListen = () => {
    if (!isSupported) { //if text-to-speech is not supported
      console.warn("Text-to-speech is not supported in this browser.");
      alert("Sorry, your browser doesn't support text-to-speech.");
      return;
    }
    if (isSpeaking) { //if already speaking
        cancel(); //stop
    } else {
        const instructions = "Select all words you find difficult to read.";
        const textToSpeak = `${instructions} ${sampleText}`;
        speak(textToSpeak);
    }
  };

  //end reading time and save stats
  const handleDone = async () => {
    const stats = await endReadingTimer();
    const totalWords = sampleText.split(" ").length;
    //storing the data in sessionStorage for other steps to access
    sessionStorage.setItem('diagnosticData', JSON.stringify({
      difficultWords: selectedWords,
      totalWords: totalWords,
      readingTimeSeconds: readingTimeSeconds || (stats?.readingTimeSeconds || 0),
      wordsPerMinute: wordsPerMinute || (stats?.wordsPerMinute || 0)
    }));
    
    navigate('/diagnostic/comprehension');
  };

  return (
    <div className="diagnostic-exercise-container">
      <Navbar />

      <div className="exercise-content">
        <div className="step-wrapper">
          <div className="step active">1</div>
          <span className="step-text">Select all words you find difficult to read.</span>
        </div>
        
        <div className="text-container">
          {sampleText.split(" ").map((word, idx) => (
            <span
              key={idx}
              className={`word ${selectedWords.includes(word) ? 'selected' : ''}`}
              onClick={() => toggleWord(word)}
            >
              {word}
            </span>
          ))}
        </div>

        <div className="action-buttons">
          <button 
            className={`listen-button ${isSpeaking ? 'speaking' : ''}`}
            onClick={handleListen} 
            disabled={!isSupported}
          >
            <span className="listen-icon">{isSpeaking ? '⏹️' : '🔊'}</span> 
            {isSpeaking ? 'Stop' : 'Listen'}
          </button>
          <button className="done-button" onClick={handleDone}>
            Done <span className="arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default DiagnosticExercise; 