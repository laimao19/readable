import React from 'react';
import { useNavigate } from 'react-router-dom';
import SideBySideDiff from './SideBySideDiff';
import './TextViewer.css';

const original = "The entrepreneur established a successful business through innovative strategies.";
const simplified = "The founder started a thriving business using simple methods.";

function TextViewer() {
  const navigate = useNavigate();
  
  return (
    <div className="viewer-container">
      <div className="header">
        <div className="logo" onClick={() => navigate('/')}>read<span className="accent">able</span></div>
        <div className="nav-buttons">
          <button 
            className="dashboard-button" 
            onClick={() => navigate('/dashboard')}
          >
            Dashboard
          </button>
          <button 
            className="daily-button"
            onClick={() => navigate('/exercises/daily')}
          >
            Daily Exercise
          </button>
          <button 
            className="dashboard-button"
            onClick={() => navigate('/results')}
          >
            View Past Results
          </button>
        </div>
      </div>
      
      <h2>Simplification Results</h2>
      <SideBySideDiff original={original} simplified={simplified} />
    </div>
  );
}

export default TextViewer;