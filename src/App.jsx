import React, { useState, useEffect } from 'react';
import CharacterView from './components/CharacterView';
import ChatAssistant from './components/ChatAssistant';
import DocumentAnalysisComponent from './components/DocumentAnalysisComponent';
import './index.css';
import './i18n';
import styled, { keyframes } from 'styled-components';

// ===== ANIMATIONS =====
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
`;

// ===== SECURE SESSION MANAGER =====
class SessionManager {
  constructor(timeoutMs = 30 * 60 * 1000) {
    this.timeout = timeoutMs;
    this.warningTime = timeoutMs - (5 * 60 * 1000);
    this.lastActivity = Date.now();
    this.warningShown = false;
    this.storageKey = 'foxmandal_session_data'; // Specific key
    
    this.startMonitoring();
  }
  
  startMonitoring() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, () => {
        this.lastActivity = Date.now();
        this.warningShown = false;
      }, { passive: true, capture: true });
    });
    
    this.intervalId = setInterval(() => {
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
    // Only clear OUR data, not everything
    localStorage.removeItem(this.storageKey);
    sessionStorage.removeItem(this.storageKey);
    
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    alert('Your session has expired for security. Please refresh to continue.');
    window.location.reload();
  }
  
  showTimeoutWarning() {
    const continueSession = confirm('Your session will expire in 5 minutes due to inactivity. Continue?');
    if (continueSession) {
      this.lastActivity = Date.now();
    }
  }
  
  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}

// ===== STYLED COMPONENTS =====
const AppContainer = styled.div`
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
`;

const LoadingOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: ${fadeIn} 0.3s ease;
  
  .loader {
    width: 50px;
    height: 50px;
    border: 4px solid rgba(102, 126, 234, 0.3);
    border-top-color: #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const ModeToggle = styled.div`
  position: fixed;
  top: 2rem;
  right: 2rem;
  z-index: 1002;
  display: flex;
  gap: 0.6rem;
  animation: ${fadeIn} 0.5s ease 0.3s both;
  
  @media (max-width: 768px) {
    top: auto;
    bottom: 6rem;
    right: 1rem;
    left: 1rem;
    justify-content: center;
    gap: 0.5rem;
  }
`;

const ToggleButton = styled.button`
  background: ${props => props.active ? 
    'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)' : 
    'rgba(30, 64, 175, 0.6)'
  };
  backdrop-filter: blur(12px);
  color: white;
  border: 1px solid ${props => props.active ? 'rgba(102, 126, 234, 0.5)' : 'rgba(102, 126, 234, 0.2)'};
  padding: 0.8rem 1.4rem;
  border-radius: 16px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: ${props => props.active ? 
    '0 8px 20px rgba(30, 64, 175, 0.4)' : 
    '0 4px 12px rgba(0, 0, 0, 0.2)'
  };
  
  &:hover {
    background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%);
    transform: translateY(-2px);
    box-shadow: 0 10px 25px rgba(30, 64, 175, 0.5);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  @media (max-width: 768px) {
    flex: 1;
    padding: 0.7rem 1rem;
    font-size: 0.85rem;
    justify-content: center;
  }
  
  @media (max-width: 380px) {
    font-size: 0.8rem;
    padding: 0.6rem 0.8rem;
    
    span:last-child {
      display: none; /* Hide text on very small screens */
    }
  }
`;

const DocumentPanel = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  background: linear-gradient(135deg, rgba(17, 24, 39, 0.98), rgba(30, 58, 138, 0.95));
  backdrop-filter: blur(25px);
  z-index: 1001;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 2rem;
  animation: ${slideIn} 0.4s ease-out;
  
  /* Better scrollbar */
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(102, 126, 234, 0.5);
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: rgba(102, 126, 234, 0.7);
  }
  
  @media (max-width: 768px) {
    padding: 1rem;
    padding-bottom: 5rem; /* Extra space for mobile */
  }
`;

const ClosePanelButton = styled.button`
  position: fixed;
  top: 2rem;
  right: 2rem;
  background: rgba(239, 68, 68, 0.9);
  color: white;
  border: none;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  font-size: 1.6rem;
  cursor: pointer;
  z-index: 1003;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
  
  &:hover {
    background: rgba(220, 38, 38, 1);
    transform: rotate(90deg) scale(1.1);
    box-shadow: 0 8px 20px rgba(239, 68, 68, 0.6);
  }
  
  &:active {
    transform: rotate(90deg) scale(1.05);
  }
  
  @media (max-width: 768px) {
    width: 44px;
    height: 44px;
    font-size: 1.4rem;
    top: 1rem;
    right: 1rem;
  }
`;

const WelcomeBadge = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.95);
  backdrop-filter: blur(20px);
  color: white;
  padding: 2.5rem 3.5rem;
  border-radius: 24px;
  text-align: center;
  z-index: 2000;
  animation: ${pulse} 2s ease-in-out infinite;
  border: 1px solid rgba(102, 126, 234, 0.3);
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
  max-width: 90vw;
  
  h2 {
    font-size: 2rem;
    margin: 0 0 1.2rem 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-weight: 700;
  }
  
  p {
    font-size: 1.05rem;
    line-height: 1.6;
    margin: 0 0 1.8rem 0;
    color: rgba(255, 255, 255, 0.9);
  }
  
  .button-group {
    display: flex;
    gap: 1rem;
    justify-content: center;
  }
  
  button {
    background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%);
    color: white;
    border: none;
    padding: 0.9rem 2.2rem;
    border-radius: 14px;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 12px rgba(30, 64, 175, 0.4);
    
    &:hover {
      transform: translateY(-3px);
      box-shadow: 0 10px 25px rgba(30, 64, 175, 0.6);
    }
    
    &:active {
      transform: translateY(-1px);
    }
  }
  
  .skip-btn {
    background: rgba(255, 255, 255, 0.1);
    box-shadow: none;
    
    &:hover {
      background: rgba(255, 255, 255, 0.15);
      box-shadow: 0 4px 12px rgba(255, 255, 255, 0.1);
    }
  }
  
  @media (max-width: 768px) {
    padding: 2rem;
    
    h2 { 
      font-size: 1.6rem; 
      margin-bottom: 1rem;
    }
    
    p { 
      font-size: 0.95rem;
      margin-bottom: 1.5rem;
    }
    
    .button-group {
      flex-direction: column;
      gap: 0.8rem;
    }
    
    button {
      width: 100%;
      padding: 0.8rem 1.5rem;
      font-size: 0.95rem;
    }
  }
  
  @media (max-width: 380px) {
    padding: 1.5rem;
    
    h2 { font-size: 1.4rem; }
    p { font-size: 0.9rem; }
  }
`;

// ===== MAIN APP COMPONENT =====
export default function App() {
  const [aiText, setLatestAIMessage] = useState("");
  const [currentView, setCurrentView] = useState('voice');
  const [showWelcome, setShowWelcome] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionId] = useState(() => 
    `session_foxmandal_${Date.now()}_${Math.random().toString(36).substring(2, 15).toLowerCase()}`
  );

  // Initialize app
  useEffect(() => {
    let sessionManager;
    
    const initApp = async () => {
      try {
        // Initialize session security
        sessionManager = new SessionManager();
        console.log('✅ Session security active (30min timeout)');
        
        // Simulate initial load (remove if not needed)
        await new Promise(resolve => setTimeout(resolve, 800));
        
        setIsLoading(false);
        
        // Auto-hide welcome after 5 seconds
        const welcomeTimer = setTimeout(() => {
          setShowWelcome(false);
        }, 5000);
        
        return () => {
          clearTimeout(welcomeTimer);
          if (sessionManager) {
            sessionManager.destroy();
          }
        };
        
      } catch (error) {
        console.error('App initialization error:', error);
        setIsLoading(false);
      }
    };
    
    initApp();
  }, []);

  const handleDocumentAnalysisComplete = (result) => {
    console.log('📄 Document analysis complete:', result);
    setLatestAIMessage(`Document analyzed: ${result.legalArea || 'Legal document'}`);
  };

  const handleSkipWelcome = () => {
    setShowWelcome(false);
  };

  return (
    <AppContainer>
      {/* Loading Screen */}
      {isLoading && (
        <LoadingOverlay>
          <div className="loader" />
        </LoadingOverlay>
      )}

      {/* Welcome Screen */}
      {showWelcome && !isLoading && (
        <WelcomeBadge>
          <h2>Welcome to FoxMandal Legal AI</h2>
          <p>
            Experience next-generation legal assistance with AI-powered voice interaction,
            intelligent document analysis, and 24/7 expert support.
          </p>
          <div className="button-group">
            <button onClick={handleSkipWelcome}>
              🚀 Get Started
            </button>
            <button className="skip-btn" onClick={handleSkipWelcome}>
              Skip Intro
            </button>
          </div>
        </WelcomeBadge>
      )}

      {/* Mode Toggle Buttons */}
      {!showWelcome && !isLoading && (
        <ModeToggle>
          <ToggleButton 
            active={currentView === 'voice'}
            onClick={() => setCurrentView('voice')}
            aria-label="Switch to Voice AI mode"
          >
            <span>🎙️</span>
            <span>Voice AI</span>
          </ToggleButton>
          <ToggleButton 
            active={currentView === 'document'}
            onClick={() => setCurrentView('document')}
            aria-label="Switch to Document Analysis mode"
          >
            <span>📄</span>
            <span>Documents</span>
          </ToggleButton>
        </ModeToggle>
      )}

      {/* Main Content */}
      {!isLoading && (
        <>
          {currentView === 'voice' ? (
            <>
              <CharacterView onMessage={setLatestAIMessage} />
              <ChatAssistant />
            </>
          ) : (
            <DocumentPanel>
              <ClosePanelButton 
                onClick={() => setCurrentView('voice')}
                aria-label="Close document panel"
              >
                ×
              </ClosePanelButton>
              <DocumentAnalysisComponent 
                sessionId={sessionId}
                onAnalysisComplete={handleDocumentAnalysisComplete}
              />
            </DocumentPanel>
          )}
        </>
      )}
    </AppContainer>
  );
}

console.log('✅ FoxMandal Legal AI loaded successfully');