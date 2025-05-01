import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Step1WordSelection.css';
import filledShape from '../../filled-shape.svg';

function Step1WordSelection() {
  const navigate = useNavigate(); //use navigate to navigate to next page
  const handleStartExercise = () => { //handle start exercise by navigating to exercise page
    navigate('/diagnostic/exercise');
  };

  return (
    <div className="diagnostic-container">
      <div className="header">
        <div className="logo">read<span className="accent">able</span></div>
        <div className="nav-buttons">
          <button className="dashboard-button" onClick={() => navigate('/dashboard')}>Dashboard</button>
        </div>
      </div>

      <div className="content">
        <div className="steps-row">
          <div className="step active">1</div>
          <div className="step">2</div>
          <div className="step">3</div>
        </div>

        <h1>Word Difficulty Detection</h1>
        
        <p className="description">
          You will be shown a short passage on the next page for you to read through.
          Please mark any words you find difficult to comprehend by clicking on them.
        </p>

        <button className="start-exercise-button" onClick={handleStartExercise}>
          Start Exercise <span className="arrow">→</span>
        </button>
      </div>

      <img src={filledShape} alt="" className="decorative-shape" />
    </div>
  );
}

export default Step1WordSelection;
