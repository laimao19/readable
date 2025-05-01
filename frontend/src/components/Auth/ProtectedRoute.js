import React from 'react';
import { useUser, RedirectToSignIn } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';

//protected route component
function ProtectedRoute({ children, needsDiagnostic = true }) {
  const { isLoaded, isSignedIn, user } = useUser(); //using user hook
  //checking if the user data is still loading
  if (!isLoaded) {
    return <div>Loading...</div>;
  }
  //if user is not signed in, redirect to sign-in
  if (!isSignedIn) {
    return <RedirectToSignIn />;
  }
  //has user completed diagnostic
  if (needsDiagnostic) {
    //if they have, get user metadata
    const hasDiagnosticCompleted = user.unsafeMetadata.diagnosticCompleted;
    //if diagnostic is not completed, redirect to diagnostic
    if (!hasDiagnosticCompleted) {
      return <Navigate to="/diagnostic" replace />;
    }
  }
  //if all checks pass, render the protected component
  return children;
}

export default ProtectedRoute; 