import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, SignedOut, SignedIn } from '@clerk/clerk-react';
import './Landing.css';
import Navbar from './Navbar';

function Landing() {
  const navigate = useNavigate();
  const { isSignedIn, user } = useUser();

  return (
    <div className="landing-wrapper">
      <SignedIn>
        <Navbar />
      </SignedIn>
      
      <SignedOut>
        <div className="header">
          <div className="logo">read<span className="accent">able</span></div>
          <div className="nav-buttons">
            <button 
              className="start-exercise-button"
              onClick={() => navigate('/sign-up')}
            >
              Get Started
            </button>
            <button 
              className="dashboard-button"
              onClick={() => navigate('/sign-in')}
            >
              Login
            </button>
          </div>
        </div>
      </SignedOut>
      
      <div className="landing-container">
        <div className="landing-content">
          <h1 className="headline">Personalized Dyslexia Reading Support</h1>
          <p className="description">
            We help people with dyslexia improve their reading through personalized daily
            practice. After a quick diagnostic, you'll get custom reading passages tailored to
            your needs — with supportive tools to track progress and build confidence.
          </p>
          <SignedOut>
            <button className="diagnostic-button" onClick={() => navigate('/sign-up')}>
              Create Free Account
            </button>
          </SignedOut>
          <SignedIn>
            {user?.unsafeMetadata?.diagnosticCompleted ? (
              <button className="diagnostic-button" onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </button>
            ) : (
              <button className="diagnostic-button" onClick={() => navigate('/diagnostic')}>
                Begin Diagnostic
              </button>
            )}
          </SignedIn>
        </div>
      </div>
    </div>
  );
}

export default Landing;