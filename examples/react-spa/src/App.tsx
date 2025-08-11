import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MonitoringProvider } from './providers/MonitoringProvider';
import { UserJourneyProvider } from './providers/UserJourneyProvider';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import DashboardPage from './pages/DashboardPage';
import ContactPage from './pages/ContactPage';
import { monitoringConfig } from './config/monitoring';
import './App.css';

function App() {
  return (
    <ErrorBoundary>
      <MonitoringProvider config={monitoringConfig}>
        <UserJourneyProvider>
          <Router>
            <div className="App">
              <Header />
              <main className="main-content">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </div>
          </Router>
        </UserJourneyProvider>
      </MonitoringProvider>
    </ErrorBoundary>
  );
}

export default App;