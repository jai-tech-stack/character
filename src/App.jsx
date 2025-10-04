import React, { useState, useEffect } from 'react';
import CharacterView from './components/CharacterView';
import ChatAssistant from './components/ChatAssistant';
import DocumentAnalysisComponent from './components/DocumentAnalysisComponent';
import './index.css';
import './i18n';
import styled, { keyframes } from 'styled-components';

// ===== ANIMATIONS =====
const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
`;

const bounce = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.7); }
  50% { transform: scale(1.05); box-shadow: 0 0 0 20px rgba(102, 126, 234, 0); }
`;

// ===== SESSION MANAGER =====
class SessionManager {
  constructor(timeoutMs = 30 * 60 * 1000) {
    this.timeout = timeoutMs;
    this.lastActivity = Date.now();
    this.storageKey = 'foxmandal_session';
    this.startMonitoring();
  }
  
  startMonitoring() {
    ['mousedown', 'keypress', 'touchstart'].forEach(event => {
      document.addEventListener(event, () => {
        this.lastActivity = Date.now();
      }, { passive: true });
    });
  }
  
  destroy() {}
}

// ===== STYLED COMPONENTS =====
const AppContainer = styled.div`
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
`;

const WelcomeScreen = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 58, 138, 0.9));
  backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  padding: 2rem;
  animation: ${fadeIn} 0.5s ease;
`;

const Logo = styled.div`
  font-size: 3rem;
  font-weight: 800;
  color: white;
  margin-bottom: 1rem;
  text-align: center;
  animation: ${slideUp} 0.8s ease;
  
  @media (max-width: 768px) {
    font-size: 2rem;
  }
`;

const Tagline = styled.p`
  font-size: 1.3rem;
  color: rgba(255, 255, 255, 0.9);
  text-align: center;
  margin-bottom: 3rem;
  max-width: 600px;
  line-height: 1.6;
  animation: ${slideUp} 0.8s ease 0.2s both;
  
  @media (max-width: 768px) {
    font-size: 1.1rem;
    margin-bottom: 2rem;
  }
`;

const BigButton = styled.button`
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  padding: 1.5rem 3rem;
  border-radius: 16px;
  font-size: 1.3rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 10px 30px rgba(16, 185, 129, 0.4);
  transition: all 0.3s ease;
  animation: ${slideUp} 0.8s ease 0.4s both, ${pulse} 2s ease-in-out 1s infinite;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  
  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 15px 40px rgba(16, 185, 129, 0.6);
  }
  
  &:active {
    transform: translateY(-2px);
  }
  
  @media (max-width: 768px) {
    padding: 1.2rem 2.5rem;
    font-size: 1.1rem;
  }
`;

const FeatureGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  margin-top: 3rem;
  max-width: 900px;
  animation: ${slideUp} 0.8s ease 0.6s both;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 1.5rem;
    margin-top: 2rem;
  }
`;

const FeatureCard = styled.div`
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 1.5rem;
  text-align: center;
  
  .icon {
    font-size: 3rem;
    margin-bottom: 0.8rem;
  }
  
  .title {
    font-size: 1.1rem;
    font-weight: 600;
    color: white;
    margin-bottom: 0.5rem;
  }
  
  .desc {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.7);
    line-height: 1.4;
  }
`;

const MainInterface = styled.div`
  width: 100%;
  height: 100vh;
  position: relative;
  animation: ${fadeIn} 0.5s ease;
`;

const HelpBubble = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 2rem 3rem;
  border-radius: 24px;
  text-align: center;
  z-index: 2000;
  max-width: 500px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  animation: ${slideUp} 0.5s ease;
  border: 2px solid #10b981;
  
  @media (max-width: 768px) {
    max-width: 90%;
    padding: 1.5rem 2rem;
  }
  
  .title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #10b981;
    margin-bottom: 1rem;
  }
  
  .instruction {
    font-size: 1.1rem;
    line-height: 1.6;
    margin-bottom: 1.5rem;
  }
  
  .got-it {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    border: none;
    padding: 0.8rem 2rem;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(16, 185, 129, 0.4);
    }
  }
`;

const FloatingArrow = styled.div`
  position: fixed;
  bottom: 12rem;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  z-index: 1500;
  animation: ${bounce} 2s ease-in-out infinite;
  
  @media (max-width: 768px) {
    bottom: 10rem;
  }
  
  .arrow {
    font-size: 3rem;
    color: #10b981;
    text-shadow: 0 0 20px rgba(16, 185, 129, 0.8);
  }
  
  .text {
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 12px;
    font-size: 0.9rem;
    font-weight: 600;
    margin-top: 0.5rem;
  }
`;

const ModeSelector = styled.div`
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 1rem;
  z-index: 1002;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(20px);
  padding: 1rem 1.5rem;
  border-radius: 20px;
  border: 2px solid rgba(102, 126, 234, 0.3);
  animation: ${slideUp} 0.5s ease;
  
  @media (max-width: 768px) {
    left: 1rem;
    right: 1rem;
    transform: none;
    justify-content: center;
  }
`;

const ModeButton = styled.button`
  background: ${props => props.active ? 
    'linear-gradient(135deg, #1e40af, #1e3a8a)' : 
    'rgba(255, 255, 255, 0.1)'
  };
  color: white;
  border: 2px solid ${props => props.active ? '#667eea' : 'rgba(255, 255, 255, 0.2)'};
  padding: 1rem 2rem;
  border-radius: 14px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  &:hover {
    background: linear-gradient(135deg, #1e40af, #1e3a8a);
    transform: translateY(-3px);
    box-shadow: 0 8px 20px rgba(30, 64, 175, 0.4);
  }
  
  @media (max-width: 768px) {
    padding: 0.8rem 1.5rem;
    font-size: 0.9rem;
  }
`;

// ===== MAIN COMPONENT =====
export default function App() {
  const [currentView, setCurrentView] = useState('voice');
  const [showWelcome, setShowWelcome] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [showArrow, setShowArrow] = useState(false);
  const [sessionId] = useState(() => 
    `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  );

  useEffect(() => {
    const sessionManager = new SessionManager();
    return () => sessionManager.destroy();
  }, []);

  const handleGetStarted = () => {
    setShowWelcome(false);
    setTimeout(() => {
      setShowHelp(true);
    }, 500);
  };

  const handleGotIt = () => {
    setShowHelp(false);
    setTimeout(() => {
      setShowArrow(true);
      setTimeout(() => setShowArrow(false), 5000);
    }, 300);
  };

  return (
    <AppContainer>
      {/* WELCOME SCREEN */}
      {showWelcome && (
        <WelcomeScreen>
          <Logo>⚖️ FoxMandal Legal AI</Logo>
          <Tagline>
            Your Personal Legal Assistant - Powered by Advanced AI<br />
            Get instant legal help through voice or analyze your documents
          </Tagline>
          
          <BigButton onClick={handleGetStarted}>
            <span>🚀</span>
            <span>Start Using Now - It's Free!</span>
          </BigButton>
          
          <FeatureGrid>
            <FeatureCard>
              <div className="icon">🎤</div>
              <div className="title">Voice Chat</div>
              <div className="desc">Talk naturally, get instant answers</div>
            </FeatureCard>
            <FeatureCard>
              <div className="icon">📄</div>
              <div className="title">Document Analysis</div>
              <div className="desc">Upload contracts for AI review</div>
            </FeatureCard>
            <FeatureCard>
              <div className="icon">⚡</div>
              <div className="title">24/7 Available</div>
              <div className="desc">Always here to help you</div>
            </FeatureCard>
          </FeatureGrid>
        </WelcomeScreen>
      )}

      {/* HELP POPUP */}
      {showHelp && (
        <HelpBubble>
          <div className="title">🎯 How to Use</div>
          <div className="instruction">
            <strong>Click the big ⚖️ symbol</strong> in the center to start talking to the AI lawyer.
            <br /><br />
            Or use the buttons at the bottom to switch between <strong>Voice Chat</strong> and <strong>Document Analysis</strong>.
          </div>
          <button className="got-it" onClick={handleGotIt}>
            Got It! Let's Go 👍
          </button>
        </HelpBubble>
      )}

      {/* FLOATING ARROW */}
      {showArrow && (
        <FloatingArrow>
          <div className="arrow">👇</div>
          <div className="text">Click the symbol to talk!</div>
        </FloatingArrow>
      )}

      {/* MAIN INTERFACE */}
      {!showWelcome && (
        <MainInterface>
          {currentView === 'voice' ? (
            <>
              <CharacterView />
              <ChatAssistant />
            </>
          ) : (
            <DocumentAnalysisComponent 
              sessionId={sessionId}
              onAnalysisComplete={(result) => {
                console.log('Analysis complete:', result);
              }}
            />
          )}

          {/* MODE SELECTOR */}
          <ModeSelector>
            <ModeButton 
              active={currentView === 'voice'}
              onClick={() => setCurrentView('voice')}
            >
              <span>🎤</span>
              <span>Talk to AI Lawyer</span>
            </ModeButton>
            <ModeButton 
              active={currentView === 'document'}
              onClick={() => setCurrentView('document')}
            >
              <span>📄</span>
              <span>Analyze Documents</span>
            </ModeButton>
          </ModeSelector>
        </MainInterface>
      )}
    </AppContainer>
  );
}

console.log('✅ FoxMandal AI loaded');