import React from 'react';
import ReactDOM from 'react-dom/client';  
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import {createBrowserRouter, RouterProvider} from 'react-router-dom'

import {AuthProvider} from './context/AuthContext'

import ExplorePage from './pages/ExplorePage'

import Login from './features/auth/Login'
import Signup from './features/auth/Signup'
import ProtectedRoute from './features/auth/ProtectedRoute'
import RootRedirect from './features/auth/RootRedirect'

import MyFarmsPage from './features/profile/MyFarmsPage'
import Dashboard from './features/profile/Dashboard'
import MyFarmDetail from './features/profile/MyFarmDetail'
import CreateFarmPage from './features/profile/CreateFarmPage'

import FarmlandDetail from './features/lands/FarmlandDetail'

import ChatPage from './features/chats/ChatPage'

import NotFound from './components/commons/NotFound'
import ErrorBoundary from './components/commons/ErrorBoundary'
import RouteErrorBoundary from './components/commons/RouteErrorBoundary'


const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <RouteErrorBoundary />,
    children: [
      // Public Routes
      { index: true, element: <RootRedirect /> },
      { path: '/auth/login/',  element: <Login /> },
      { path: '/auth/signup/', element: <Signup /> },
      { path: '/explore/',     element: <ExplorePage /> },
      { path: '/farm/:id',     element: <FarmlandDetail /> },
      { path: '/*',            element: <NotFound /> },

      // Protected Routes
      {
        element: <ProtectedRoute />,
        children: [
          { path: '/profile/',          element: <Dashboard /> },
          { path: '/profile/farms/',    element: <MyFarmsPage /> },
          { path: '/profile/farms/:id', element: <MyFarmDetail /> },
          { path: '/profile/farms/createfarm', element: <CreateFarmPage /> },
          { path: '/chats', element: <ChatPage/> },

        ],
      },
    ],
  },
]);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* This top-level boundary is for crashes *outside* the router's own
        error handling — e.g. AuthProvider's initial render, which reads
        and parses localStorage before the router even mounts (see the
        safe-parse fix in AuthContext.jsx). The router's own errorElement
        above only catches errors thrown by routed page components. */}
    <ErrorBoundary label="app root">
      <AuthProvider>
        <RouterProvider router={router}/>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
