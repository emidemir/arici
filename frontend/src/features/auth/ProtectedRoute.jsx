import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
// Adjust this import path based on exactly where your useAuth hook lives
import { useAuth } from '../../context/AuthContext'; 

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  // 1. Wait for auth state to initialize before making a decision
  // (Prevents a brief flicker/redirect if Firebase or your API is still checking the token)
  if (loading) {
    return (
      <div className="loading-screen">
        <p>Loading...</p>
      </div>
    ); 
  }

  // 2. If no user is logged in, kick them to the login page
  if (!user) {
    // We pass the current location in state so they can be redirected back 
    // to the page they originally requested after a successful login
    return <Navigate to="/auth/login/" state={{ from: location }} replace />;
  }

  // 3. If they are logged in, render the protected child routes
  return <Outlet />;
}