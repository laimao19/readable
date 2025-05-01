import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';
import { useUser, useAuth } from '@clerk/clerk-react';
import Navbar from './Navbar';

function Dashboard() {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const [userStats, setUserStats] = useState(null);
  const [derivedStats, setDerivedStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  //formatting reading time as hours and minutes
  const formatReadingTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  //function to fetch user stats from the backend
  const fetchUserStats = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;
      const response = await fetch('/api/user/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.status}`);
      }

      const statsData = await response.json(); //stats data
      setUserStats(statsData);
      //calculating derived stats based on fetched data
      const derived = {
        accuracy: statsData.totalComprehensionQuestions > 0 
          ? ((statsData.totalCorrectComprehensionAnswers / statsData.totalComprehensionQuestions) * 100).toFixed(1) 
          : 0,
      };
      setDerivedStats(derived);
    } catch (error) {
      console.error('Error fetching user stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    //fetching user stats from backend API when component mounts or user changes
    if (isSignedIn) {
      fetchUserStats();
    }
  }, [isSignedIn, getToken]); //rerun effect if isSignedIn or getToken changes

  return (
    <div className="dashboard-container">
      <Navbar />
      <div className="dashboard-content">
        <div className="welcome-actions-section">
          <div className="welcome-text">
            <h2>Hey there!</h2>
            <p>This is your reading journey this week</p>
          </div>
          <div className="action-buttons-group">
            <button 
              className="daily-button"
              onClick={() => {
                navigate('/exercises/daily');
              }}
            >
              Start New Session
            </button>
            <button 
              className="dashboard-button"
              onClick={() => {
                navigate('/results');
              }}
            >
              View Past Results
            </button>
          </div>
        </div>
        {loading ? (
          <div className="loading-container">
            <p>Loading your dashboard...</p>
          </div>
        ) : userStats ? (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">🔥</div>
                <div className="stat-title">Streak</div>
                <div className="stat-value">{userStats.streak} days</div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">📚</div>
                <div className="stat-title">Reading Level</div>
                <div className="stat-value">
                  {userStats?.readingLevel
                    ? userStats.readingLevel.charAt(0).toUpperCase() + userStats.readingLevel.slice(1)
                    : 'Intermediate'}
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">⏱️</div>
                <div className="stat-title">Reading Time</div>
                <div className="stat-value">{formatReadingTime(userStats.totalReadingTime)}</div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">🎯</div>
                <div className="stat-title">Comprehension</div>
                <div className="stat-value">{userStats.averageComprehensionScore?.toFixed(1) ?? 'N/A'}%</div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">⚡</div>
                <div className="stat-title">Reading Speed</div>
                <div className="stat-value">{userStats.averageWPM || 0} WPM</div>
              </div>
            </div>
            
            <div className="progress-section">
              <div className="section-header">
                <div className="section-icon">📊</div>
                <h2>Your Progress</h2>
              </div>
              <div className="progress-chart">
                <div className="chart-labels">
                  <div>100</div>
                  <div>80</div>
                  <div>60</div>
                  <div>40</div>
                  <div>20</div>
                  <div>0</div>
                </div>
                <div className="chart-content">
                  <div 
                    className="progress-line"
                    style={{
                      backgroundImage: `linear-gradient(to right, #3bb9b6, #3bb9b6 ${userStats.progress}%, transparent ${userStats.progress}%)`
                    }}
                  ></div>
                  <div className="time-labels">
                    <div>Aug 30</div>
                    <div>Sep 30</div>
                    <div>Oct 31</div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="no-stats-message">
            <p>No reading stats available yet. Start a diagnostic or try a daily exercise!</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard; 