import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './components/notifications';
import { NotificationCenterProvider } from './components/notifications/NotificationCenterContext';
import { ConfirmProvider } from './components/notifications/ConfirmDialog';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import NotificationContainer from './components/notifications/NotificationContainer';
import { appConfig as config } from './config/runtime-config';
import ChangePasswordPage from './components/ChangePasswordPage';

function registerServiceWorker() {
  if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
    });
  }
}

function App() {
  registerServiceWorker();
  return (
    <ErrorBoundary>
      <Router>
        <ThemeProvider>
          <NotificationProvider>
            <AuthProvider>
              <ConfirmProvider>
                <NotificationCenterProvider>
                  <Routes>
                    <Route
                      path="/login"
                      element={
                        config.auth.enabled ? (
                          <LoginPage />
                        ) : (
                          <Navigate to="/dashboard" replace />
                        )
                      }
                    />
                    <Route
                      path="/change-password"
                      element={<ChangePasswordPage />}
                    />
                    <Route
                      path="/dashboard/:viewId?"
                      element={
                        <ProtectedRoute>
                          <Dashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/"
                      element={<Navigate to="/dashboard" replace />}
                    />
                  </Routes>
                  <NotificationContainer />
                </NotificationCenterProvider>
              </ConfirmProvider>
            </AuthProvider>
          </NotificationProvider>
        </ThemeProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
