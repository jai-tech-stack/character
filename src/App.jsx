import React, { useState } from 'react';
import CharacterView from './components/CharacterView';
import ChatAssistant from './components/ChatAssistant';
import './index.css';
import './i18n';

export class SessionManager {
  constructor(timeoutMs = 30 * 60 * 1000) { // 30 minutes
    this.timeout = timeoutMs;
    this.warningTime = timeoutMs - (5 * 60 * 1000); // 5 minutes before timeout
    this.lastActivity = Date.now();
    this.warningShown = false;
    
    this.startMonitoring();
  }
  
  startMonitoring() {
    // Track user activity
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
      document.addEventListener(event, () => {
        this.lastActivity = Date.now();
        this.warningShown = false;
      }, true);
    });
    
    // Check for timeout every minute
    setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - this.lastActivity;
      
      if (timeSinceActivity > this.timeout) {
        this.handleTimeout();
      } else if (timeSinceActivity > this.warningTime && !this.warningShown) {
        this.showTimeoutWarning();
        this.warningShown = true;
      }
    }, 60000);
  }
  
  handleTimeout() {
    // Clear sensitive data
    localStorage.clear();
    sessionStorage.clear();
    
    // Stop any ongoing TTS
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    // Show timeout message
    alert('Your session has expired for security reasons. Please refresh the page to continue.');
    
    // Optionally reload the page
    window.location.reload();
  }
  
  showTimeoutWarning() {
    const continueSession = confirm('Your session will expire in 5 minutes due to inactivity. Continue?');
    if (continueSession) {
      this.lastActivity = Date.now();
    }
  }
}

// Initialize session manager (Add to App.jsx)
// const sessionManager = new SessionManager();

console.log('Security framework implementation loaded');

export default function App() {
  const [aiText, setLatestAIMessage] = useState("");

  return (
    <>
      <CharacterView onMessage={setLatestAIMessage} />
       
    </>
  );
}
