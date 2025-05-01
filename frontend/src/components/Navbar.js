import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, useClerk } from '@clerk/clerk-react';
import './Navbar.css';

function Navbar() {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();

  return (
    <div className="header">
      <div className="left-section">
        <div className="logo" onClick={() => navigate('/')}>
          read<span className="accent">able</span>
        </div>
        {isLoaded && isSignedIn && (
          <button 
            className="nav-button dashboard-nav-button"
            onClick={() => navigate('/dashboard')}
          >
            Dashboard
          </button>
        )}
      </div>
      <div className="user-info">
        {isLoaded && isSignedIn && (
          <>
            <div className="user-profile">
              <img 
                src={user.imageUrl} 
                alt="Profile" 
                className="profile-image"
              />
              <span className="user-name">{user.firstName || user.username}</span>
            </div>
            <button 
              className="sign-out-button header-sign-out"
              onClick={() => {
                signOut().then(() => {
                  navigate('/');
                });
              }}
            >
              Sign Out
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default Navbar; 