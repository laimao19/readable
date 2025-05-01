import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SignUp as ClerkSignUp } from '@clerk/clerk-react';
import './Auth.css';

//sign up component with clerk
function SignUp() {
  const navigate = useNavigate();
  
  return (
    <div className="auth-container">
      <div className="header">
        <div className="logo" onClick={() => navigate('/')}>
          read<span className="accent">able</span>
        </div>
        <div className="nav-buttons">
          <button 
            className="dashboard-button"
            onClick={() => navigate('/sign-in')}
          >
            Login
          </button>
        </div>
      </div>
      
      <div className="auth-content">
        <div className="clerk-container">
          <ClerkSignUp 
            routing="path" 
            path="/sign-up" 
            signInUrl="/sign-in"
            fallbackRedirectUrl="/dashboard"
          />
        </div>
      </div>
    </div>
  );
}

export default SignUp; 