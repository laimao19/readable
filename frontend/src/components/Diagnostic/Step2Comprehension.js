import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Step2Comprehension.css';
import filledShape from '../../filled-shape.svg';
import useTextToSpeech from '../../hooks/useTextToSpeech';


const passageText = "The Greek island of Agios Efstratios is so remote, so forgotten by the banks, the government and most of the modern world that there isn't a single ATM or credit-card machine on the island. Before the economic crisis in Greece, residents of this tranquil island in the northern Aegean managed quite well. They did their banking at the post office and the few dozen rooms to rent were fully booked every summer with people who had heard – by word of mouth – of its spectacular empty beaches, clear seas and fresh seafood.";
const questions = {
  1: {
    text: "What event dramatically reduced the quality of life for residents in Agios Efstratios?",
    options: {
      A: "The financial crisis that occurred in the country",
      B: "A storm in the northern Aegean sea that devastated the island",
      C: "The removal of ATM machines from the island",
      D: "The installment of a new government"
    }
  },
  2: {
    text: "What was true about tourism in Agios Efstratios before the recent financial crisis?",
    options: {
      A: "A small number of tourists visited Agios Efstratios each summer",
      B: "Tourists overcrowded Agios Efstratios",
      C: "Agios Efstratios was so remote that tourists were not able to access it",
      D: "Many tourism agencies gave awards to Agios Efstratios"
    }
  },
  3: {
    text: "Are there many hotels in Agios Efstratios?",
    options: {
      A: "No, as there are only a small number of rooms for rent",
      B: "No, the beaches are empty of hotels",
      C: "Yes, they are all in remote locations",
      D: "Yes, the island has several 5-star resorts"
    }
  }
};

function Step2Comprehension() {
  const [stage, setStage] = useState('intro'); //stages possible: intro, reading, questions
  const [currentQuestion, setCurrentQuestion] = useState(1); //track current question (1, 2, or 3)
  const [selectedOptions, setSelectedOptions] = useState({ //tracking selected options
    1: null,
    2: null,
    3: null
  });
  const navigate = useNavigate(); //using navigate to navigate to next page
  const { speak, cancel, isSpeaking, isSupported } = useTextToSpeech(); //using text-to-speech hook

  //cancel speech on stage change or unmount
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [stage, cancel]);
  //cancel speech on question change
  useEffect(() => {
      cancel();
  }, [currentQuestion, cancel]);

  //handling start exercise
  const handleStartExercise = () => {
    cancel();
    setStage('reading');
  };

  //handling next after reading (questions)
  const handleNextAfterReading = () => {
    cancel(); 
    setStage('questions');
  };

  //handling option select
  const handleOptionSelect = (questionNumber, option) => {
    setSelectedOptions(prev => ({
      ...prev,
      [questionNumber]: option
    }));
  };

  //handling next question
  const handleNextQuestion = () => {
    cancel();
    if (currentQuestion < 3) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      //storing the comprehension answers in sessionStorage
      const diagnosticData = JSON.parse(sessionStorage.getItem('diagnosticData') || '{}');
      sessionStorage.setItem('diagnosticData', JSON.stringify({
        ...diagnosticData,
        comprehensionAnswers: selectedOptions
      }));
      
      navigate('/diagnostic/recall');
    }
  };

  //handling previous question
  const handlePreviousQuestion = () => {
    cancel();
    if (currentQuestion > 1) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  //handling listen reading
  const handleListenReading = () => {
    if (!isSupported) return alert("Sorry, your browser doesn't support text-to-speech.");
    if (isSpeaking) {
      cancel();
    } else {
      const instructions = "Read through the passage.";
      const textToSpeak = `${instructions} ${passageText}`;
      speak(textToSpeak);
    }
  };
  
  //handling listen question
  const handleListenQuestion = () => {
      if (!isSupported) return alert("Sorry, your browser doesn't support text-to-speech.");
      if (isSpeaking) {
          cancel();
      } else {
          const questionData = questions[currentQuestion];
          const instructionText = `Answer the comprehension questions. Question ${currentQuestion} of 3.`;
          const questionText = questionData.text;
          const optionsText = Object.entries(questionData.options)
                                    .map(([key, value]) => `${key}. ${value}`)
                                    .join('. ');
          const textToSpeak = `${instructionText} ${questionText} ${optionsText}`;
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
            <div className="step active">2</div>
            <div className="step">3</div>
          </div>

          <h1>Comprehension</h1>
          
          <p className="description">
            You will be shown a simple 2-3 sentence passage on the next page that you will
            read through. When you're done reading, you will be asked several follow-up
            questions about the passage you just read.
          </p>

          <button className="start-exercise-button" onClick={handleStartExercise}>
            Start Exercise <span className="arrow">→</span>
          </button>
        </div>

        <img src={filledShape} alt="" className="decorative-shape" />
      </div>
    );
  }
  if (stage === 'reading') {
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
            <div className="step active">2</div>
            <span className="step-text">Read through the passage.</span>
          </div>
          
          <div className="text-container">
            <p>{passageText}</p> 
          </div>

          <div className="action-buttons">
             <button 
                className={`listen-button ${isSpeaking ? 'speaking' : ''}`} 
                onClick={handleListenReading} 
                disabled={!isSupported}
             >
               <span className="listen-icon">{isSpeaking ? '⏹️' : '🔊'}</span> 
               {isSpeaking ? 'Stop' : 'Listen'}
            </button>
            <button className="next-button" onClick={handleNextAfterReading}>
              Next
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestionData = questions[currentQuestion];
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
          <div className="step active">2</div>
          <span className="step-text">Answer the comprehension questions ({currentQuestion}/3).</span>
        </div>
        
        <div className="questions-container">
           <div className="question">
              <h3>{currentQuestion}. {currentQuestionData.text}</h3> 
              
              <div className="options">
                {Object.entries(currentQuestionData.options).map(([key, value]) => (
                   <div 
                      key={key}
                      className={`option ${selectedOptions[currentQuestion] === key ? 'selected' : ''}`}
                      onClick={() => handleOptionSelect(currentQuestion, key)}
                   >
                      {key}. {value}
                    </div>
                ))}
              </div>
            </div>
        </div>

        <div className="navigation-buttons">
           <button 
              className="listen-question-button" 
              onClick={handleListenQuestion} 
              disabled={!isSupported}
              title={isSpeaking ? 'Stop speaking' : 'Listen to question and options'}
            >
             <span className="listen-icon">{isSpeaking ? '⏹️' : '🔊'}</span>
             {isSpeaking ? 'Stop' : 'Listen'}
          </button>
          <button className="previous-button" onClick={handlePreviousQuestion} disabled={currentQuestion === 1}>
            <span className="arrow">←</span> Previous
          </button>
          <button className="next-button" onClick={handleNextQuestion}>
            {currentQuestion === 3 ? 'Finish' : 'Next'} <span className="arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default Step2Comprehension;