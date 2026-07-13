import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './components/notifications';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import NotificationContainer from './components/notifications/NotificationContainer';
import config from './config/app-config.json';
import ChangePasswordPage from './components/ChangePasswordPage';

function App() {
  return (
    <Router>
      <ThemeProvider>
        <NotificationProvider>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={
                config.auth.enabled ? <LoginPage /> : <Navigate to="/dashboard" replace />
              } />
              <Route path="/change-password" element={<ChangePasswordPage />} />
              <Route path="/dashboard/:viewId?" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Routes>
            <NotificationContainer />
          </AuthProvider>
        </NotificationProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;