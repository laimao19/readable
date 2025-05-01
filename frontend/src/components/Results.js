import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import './Results.css';
import Navbar from './Navbar';

function Results() {
  const navigate = useNavigate(); //navigation to other pages
  const { getToken } = useAuth(); //get token from auth hook
  const [userStats, setUserStats] = useState(null); //user stats
  const [pastExercises, setPastExercises] = useState([]); //past exercises
  const [diagnosticResults, setDiagnosticResults] = useState(null); //diagnostic results
  const [loading, setLoading] = useState(true); //loading state
  const [activeTab, setActiveTab] = useState('exercises'); //active tab -> exercises or diagnostic
  const [error, setError] = useState(null); //error state

  //formatting date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  //formatting reading time as hours and minutes
  const formatReadingTime = (minutes) => {
    if (!minutes) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  //function to fetch user stats and history from the backend
  const fetchUserData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication token not available");
      }
      const statsResponse = await fetch('/api/user/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!statsResponse.ok) {
        throw new Error(`Failed to fetch stats: ${statsResponse.status}`);
      }
      const statsData = await statsResponse.json();
      setUserStats(statsData);
      const exercisesResponse = await fetch('/api/user/exercises', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!exercisesResponse.ok) {
        throw new Error(`Failed to fetch exercises: ${exercisesResponse.status}`);
      }
      const exercisesData = await exercisesResponse.json();
      setPastExercises(exercisesData);
      const diagnosticResponse = await fetch('/api/user/diagnostic-results', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!diagnosticResponse.ok) {
        throw new Error(`Failed to fetch diagnostic results: ${diagnosticResponse.status}`);
      }
      const diagnosticData = await diagnosticResponse.json();
      if (diagnosticData) {
        setDiagnosticResults({
          ...diagnosticData,
          recommendedExercises: [
            'Daily reading practice',
            'Vocabulary building',
            'Comprehension questions'
          ]
        });
      } else if (statsData && statsData.readingLevel) {
        //fallback for basic diagnostic data from user stats
        setDiagnosticResults({
          completedAt: statsData.updatedAt || new Date(),
          readingLevel: statsData.readingLevel,
          accuracyScore: 75, 
          comprehensionScore: 70,
          speedScore: 65,
          recommendedExercises: [
            'Daily reading practice',
            'Vocabulary building',
            'Comprehension questions'
          ]
        });
      }
    } catch (err) {
      console.error('Error fetching results data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchUserData();
  }, [getToken]);

  return (
    <div className="results-container">
      <Navbar />

      <div className="results-content">
        <h1>Your Reading History</h1>
        
        {loading ? (
          <div className="loading-container">
            <p>Loading your results...</p>
          </div>
        ) : error ? (
          <div className="error-container">
            <p>Error loading your results: {error}</p>
            <button 
              className="retry-button"
              onClick={fetchUserData}
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            <div className="tabs">
              <button 
                className={`tab ${activeTab === 'exercises' ? 'active' : ''}`}
                onClick={() => setActiveTab('exercises')}
              >
                Past Exercises
              </button>
              <button 
                className={`tab ${activeTab === 'diagnostic' ? 'active' : ''}`}
                onClick={() => setActiveTab('diagnostic')}
              >
                Diagnostic Results
              </button>
            </div>

            {activeTab === 'exercises' && (
              <div className="exercises-list">
                <h2>Completed Exercises</h2>
                {pastExercises.length === 0 ? (
                  <p className="no-data">You haven't completed any exercises yet. Start with a daily exercise!</p>
                ) : (
                  <div className="exercise-cards">
                    {pastExercises.map(exercise => (
                      <div className="exercise-card" key={exercise.id}>
                        <div className="exercise-date">{formatDate(exercise.completedAt)}</div>
                        <div className="exercise-type">{exercise.type}</div>
                        <div className="exercise-details">
                          <div className="detail">
                            <span className="detail-label">Time spent:</span>
                            <span className="detail-value">{formatReadingTime(exercise.minutesRead)}</span>
                          </div>
                          <div className="detail">
                            <span className="detail-label">Passages read:</span>
                            <span className="detail-value">{exercise.passagesRead}</span>
                          </div>
                          <div className="detail">
                            <span className="detail-label">Difficult words:</span>
                            <span className="detail-value">{exercise.difficultWordPercentage.toFixed(1)}%</span>
                          </div>
                          {exercise.wordsPerMinute > 0 && (
                            <div className="detail">
                              <span className="detail-label">Reading Speed:</span>
                              <span className="detail-value">{exercise.wordsPerMinute} WPM</span>
                            </div>
                          )}
                          {exercise.comprehensionScore > 0 && (
                            <div className="detail">
                              <span className="detail-label">Comprehension:</span>
                              <span className="detail-value">{exercise.comprehensionScore}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="stats-summary">
                  <h3>Overall Statistics</h3>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-icon">📚</div>
                      <div className="stat-title">Total Reading Time</div>
                      <div className="stat-value">{formatReadingTime(userStats?.totalReadingTime)}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon">📖</div>
                      <div className="stat-title">Passages Read</div>
                      <div className="stat-value">{userStats?.totalPassagesRead || 0}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon">✓</div>
                      <div className="stat-title">Exercises Completed</div>
                      <div className="stat-value">{userStats?.totalExercisesCompleted || 0}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon">🔥</div>
                      <div className="stat-title">Current Streak</div>
                      <div className="stat-value">{userStats?.streak || 0} days</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon">⚡</div>
                      <div className="stat-title">Reading Speed</div>
                      <div className="stat-value">{userStats?.averageWPM || 0} WPM</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'diagnostic' && diagnosticResults && (
              <div className="diagnostic-results">
                <h2>Diagnostic Assessment</h2>
                <div className="diagnostic-date">
                  Completed on: {formatDate(diagnosticResults.completedAt)}
                </div>
                
                <div className="reading-level-card">
                  <div className="level-title">Your Reading Level</div>
                  <div className="level-value">
                    {diagnosticResults.readingLevel.charAt(0).toUpperCase() + diagnosticResults.readingLevel.slice(1)}
                  </div>
                  <p className="level-description">
                    Based on your diagnostic results, we've determined your current reading level.
                    All exercises and content will be tailored to this level to help you improve.
                  </p>
                </div>
                
                <div className="scores-section">
                  <h3>Performance Breakdown</h3>
                  <div className="score-bars">
                    <div className="score-bar">
                      <div className="score-label">Accuracy</div>
                      <div className="bar-container">
                        <div 
                          className="bar-fill" 
                          style={{width: `${diagnosticResults.accuracyScore}%`}}
                        ></div>
                      </div>
                      <div className="score-value">{diagnosticResults.accuracyScore}%</div>
                    </div>
                    <div className="score-bar">
                      <div className="score-label">Comprehension</div>
                      <div className="bar-container">
                        <div 
                          className="bar-fill" 
                          style={{width: `${diagnosticResults.comprehensionScore}%`}}
                        ></div>
                      </div>
                      <div className="score-value">{diagnosticResults.comprehensionScore}%</div>
                    </div>
                    <div className="score-bar">
                      <div className="score-label">Reading Speed</div>
                      <div className="bar-container">
                        <div 
                          className="bar-fill" 
                          style={{width: `${diagnosticResults.speedScore}%`}}
                        ></div>
                      </div>
                      <div className="score-value">{diagnosticResults.speedScore}%</div>
                    </div>
                  </div>
                </div>
                
                <div className="recommendations">
                  <h3>Recommended Exercises</h3>
                  <ul className="recommendation-list">
                    {diagnosticResults.recommendedExercises.map((rec, index) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                </div>
                
                <div className="action-buttons">
                  <button 
                    className="restart-diagnostic" 
                    onClick={() => navigate('/diagnostic')}
                  >
                    Retake Diagnostic
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Results; 