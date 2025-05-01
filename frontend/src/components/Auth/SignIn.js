import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SignIn as ClerkSignIn } from '@clerk/clerk-react';
import './Auth.css';

//sign in component with clerk
function SignIn() {
  const navigate = useNavigate();
  
  return (
    <div className="auth-container">
      <div className="header">
        <div className="logo" onClick={() => navigate('/')}>read<span className="accent">able</span></div>
        <div className="nav-buttons">
          <button 
            className="start-exercise-button"
            onClick={() => navigate('/sign-up')}
          >
            Sign Up
          </button>
        </div>
      </div>
      <div className="auth-content">
        <div className="clerk-container">
          <ClerkSignIn 
            routing="path" 
            path="/sign-in" 
            signUpUrl="/sign-up"
            fallbackRedirectUrl="/dashboard"
          />
        </div>
      </div>
    </div>
  );
}

export default SignIn; 