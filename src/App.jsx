import React, { useState, useEffect } from 'react';
import CharacterView from './components/CharacterView';
import ChatAssistant from './components/ChatAssistant';
import DocumentAnalysisComponent from './components/DocumentAnalysisComponent';
import './index.css';
import './i18n';
import styled from 'styled-components';

// ===== SESSION MANAGER - SECURITY =====
class SessionManager {
  constructor(timeoutMs = 30 * 60 * 1000) {
    this.timeout = timeoutMs;
    this.warningTime = timeoutMs - (5 * 60 * 1000);
    this.lastActivity = Date.now();
    this.warningShown = false;
    
    this.startMonitoring();
  }
  
  startMonitoring() {
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
      document.addEventListener(event, () => {
        this.lastActivity = Date.now();
        this.warningShown = false;
      }, true);
    });
    
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
    localStorage.clear();
    sessionStorage.clear();
    
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    alert('Your session has expired for security reasons. Please refresh the page to continue.');
    window.location.reload();
  }
  
  showTimeoutWarning() {
    const continueSession = confirm('Your session will expire in 5 minutes due to inactivity. Continue?');
    if (continueSession) {
      this.lastActivity = Date.now();
    }
  }
}

// ===== STYLED COMPONENTS =====
const AppContainer = styled.div`
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
`;

const ModeToggle = styled.div`
  position: fixed;
  top: 2rem;
  right: 2rem;
  z-index: 1002;
  display: flex;
  gap: 0.5rem;
  
  @media (max-width: 768px) {
    top: 1rem;
    right: 1rem;
    flex-direction: column;
  }
`;

const ToggleButton = styled.button`
  background: ${props => props.active ? 
    'linear-gradient(45deg, #1e40af, #1e3a8a)' : 
    'rgba(30, 64, 175, 0.7)'
  };
  backdrop-filter: blur(10px);
  color: white;
  border: 1px solid rgba(102, 126, 234, 0.3);
  padding: 0.7rem 1.2rem;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  
  &:hover {
    background: linear-gradient(45deg, #1e40af, #1e3a8a);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
  }
  
  @media (max-width: 768px) {
    padding: 0.6rem 1rem;
    font-size: 0.8rem;
  }
`;

const DocumentPanel = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  background: linear-gradient(135deg, rgba(17, 24, 39, 0.98), rgba(30, 58, 138, 0.95));
  backdrop-filter: blur(20px);
  z-index: 1001;
  overflow-y: auto;
  padding: 2rem;
  animation: slideIn 0.3s ease-out;
  
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

const ClosePanelButton = styled.button`
  position: fixed;
  top: 2rem;
  right: 2rem;
  background: rgba(239, 68, 68, 0.9);
  color: white;
  border: none;
  width: 45px;
  height: 45px;
  border-radius: 50%;
  font-size: 1.5rem;
  cursor: pointer;
  z-index: 1003;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  
  &:hover {
    background: rgba(220, 38, 38, 1);
    transform: rotate(90deg) scale(1.1);
  }
  
  @media (max-width: 768px) {
    width: 40px;
    height: 40px;
    top: 1rem;
    right: 1rem;
  }
`;

const WelcomeBadge = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 2rem 3rem;
  border-radius: 20px;
  text-align: center;
  z-index: 2000;
  animation: fadeIn 0.5s ease-out;
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translate(-50%, -40%); }
    to { opacity: 1; transform: translate(-50%, -50%); }
  }
  
  h2 {
    font-size: 1.8rem;
    margin-bottom: 1rem;
    color: #667eea;
  }
  
  p {
    font-size: 1rem;
    line-height: 1.5;
    margin-bottom: 1.5rem;
  }
  
  button {
    background: linear-gradient(45deg, #1e40af, #1e3a8a);
    color: white;
    border: none;
    padding: 0.8rem 2rem;
    border-radius: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
    }
  }
  
  @media (max-width: 768px) {
    width: 90%;
    padding: 1.5rem;
    
    h2 { font-size: 1.4rem; }
    p { font-size: 0.9rem; }
  }
`;

// ===== MAIN APP COMPONENT =====
export default function App() {
  const [aiText, setLatestAIMessage] = useState("");
  const [currentView, setCurrentView] = useState('voice'); // 'voice' or 'document'
  const [showWelcome, setShowWelcome] = useState(true);
  const [sessionId] = useState(() => 
    `session_foxmandal_agentic_${Date.now()}_${Math.random().toString(36).substring(2, 15).toLowerCase()}`
  );

  // Initialize Session Manager on mount
  useEffect(() => {
    const sessionManager = new SessionManager();
    console.log('Session security active - 30min timeout enabled');
    
    // Auto-hide welcome after 5 seconds
    const welcomeTimer = setTimeout(() => {
      setShowWelcome(false);
    }, 5000);
    
    return () => {
      clearTimeout(welcomeTimer);
    };
  }, []);

  const handleDocumentAnalysisComplete = (result) => {
    console.log('Document analysis complete:', result.documentType);
    setLatestAIMessage(`Document analyzed: ${result.documentType}`);
  };

  return (
    <AppContainer>
      {/* Welcome Screen */}
      {showWelcome && (
        <WelcomeBadge>
          <h2>Welcome to FoxMandal Legal AI</h2>
          <p>
            Powered by Smart AI with voice interaction,<br />
            document analysis, and 24/7 legal assistance.
          </p>
          <button onClick={() => setShowWelcome(false)}>
            Get Started
          </button>
        </WelcomeBadge>
      )}

      {/* Mode Toggle Buttons */}
      {!showWelcome && (
        <ModeToggle>
          <ToggleButton 
            active={currentView === 'voice'}
            onClick={() => setCurrentView('voice')}
          >
            <span>🎙️</span>
            <span>Voice AI</span>
          </ToggleButton>
          <ToggleButton 
            active={currentView === 'document'}
            onClick={() => setCurrentView('document')}
          >
            <span>📄</span>
            <span>Documents</span>
          </ToggleButton>
        </ModeToggle>
      )}

      {/* Main Content */}
      {currentView === 'voice' ? (
        <>
          <CharacterView onMessage={setLatestAIMessage} />
          <ChatAssistant />
        </>
      ) : (
        <DocumentPanel>
          <ClosePanelButton onClick={() => setCurrentView('voice')}>
            ×
          </ClosePanelButton>
          <DocumentAnalysisComponent 
            sessionId={sessionId}
            onAnalysisComplete={handleDocumentAnalysisComplete}
          />
        </DocumentPanel>
      )}
    </AppContainer>
  );
}

console.log('FoxMandal Legal AI - All features loaded successfully');