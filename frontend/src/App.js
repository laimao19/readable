import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ClerkLoaded, ClerkLoading } from '@clerk/clerk-react';
import Landing from './components/Landing';
import Step1WordSelection from './components/Diagnostic/Step1WordSelection';
import DiagnosticExercise from './components/Diagnostic/DiagnosticExercise';
import Step2Comprehension from './components/Diagnostic/Step2Comprehension';
import Step3Recall from './components/Diagnostic/Step3Recall';
import TextViewer from './components/Simplifier/TextViewer';
import Dashboard from './components/Dashboard';
import DailyExercise from './components/Exercises/DailyExercise';
import Results from './components/Results';
import SignIn from './components/Auth/SignIn';
import SignUp from './components/Auth/SignUp';
import ProtectedRoute from './components/Auth/ProtectedRoute';

function App() {
  return (
    <Router>
      <ClerkLoading>
        <div className="loading-screen">Loading...</div>
      </ClerkLoading>
      
      <ClerkLoaded>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/sign-in/*" element={<SignIn />} />
          <Route path="/sign-up/*" element={<SignUp />} />
          <Route 
            path="/diagnostic" 
            element={
              <ProtectedRoute needsDiagnostic={false}>
                <Step1WordSelection />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/diagnostic/exercise" 
            element={
              <ProtectedRoute needsDiagnostic={false}>
                <DiagnosticExercise />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/diagnostic/comprehension" 
            element={
              <ProtectedRoute needsDiagnostic={false}>
                <Step2Comprehension />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/diagnostic/recall" 
            element={
              <ProtectedRoute needsDiagnostic={false}>
                <Step3Recall />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/results" 
            element={
              <ProtectedRoute>
                <Results />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/simplify" 
            element={
              <ProtectedRoute>
                <TextViewer />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/exercises/daily" 
            element={
              <ProtectedRoute>
                <DailyExercise />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </ClerkLoaded>
    </Router>
  );
}

export default App;