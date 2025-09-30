// Production CharacterView.jsx - Clean & Professional
import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import styled, { keyframes, createGlobalStyle } from "styled-components";
import { useSpeechRecognition } from "react-speech-kit";
import { sendMessage, getTTS, stopTTS } from "../api/chatApi";

// ===== ANIMATIONS =====

const gradientShift = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.7); }
  50% { transform: scale(1.08); box-shadow: 0 0 0 20px rgba(102, 126, 234, 0); }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const processingGlow = keyframes`
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
`;

// ===== GLOBAL STYLES =====

const GlobalStyles = createGlobalStyle`
  * { 
    box-sizing: border-box; 
    margin: 0;
    padding: 0;
  }
  
  body { 
    margin: 0; 
    overflow: hidden; 
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
`;

// ===== STYLED COMPONENTS =====

const Container = styled.div`
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
  background-size: 200% 200%;
  animation: ${gradientShift} 15s ease infinite;
`;

const Header = styled.header`
  position: absolute;
  top: 2rem;
  left: 2rem;
  z-index: 100;
  
  @media (max-width: 768px) {
    top: 1rem;
    left: 1rem;
  }
`;

const Logo = styled.div`
  background: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(20px);
  padding: 1rem 1.5rem;
  border-radius: 16px;
  border: 1px solid rgba(102, 126, 234, 0.2);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  
  @media (max-width: 768px) {
    padding: 0.75rem 1.25rem;
  }
  
  .brand {
    font-size: 1.25rem;
    font-weight: 700;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 0.25rem;
    
    @media (max-width: 768px) {
      font-size: 1.1rem;
    }
  }
  
  .tagline {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.7);
    font-weight: 500;
    
    @media (max-width: 768px) {
      font-size: 0.75rem;
    }
  }
`;

const StatusPanel = styled.div`
  position: absolute;
  top: 2rem;
  right: 2rem;
  background: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(20px);
  padding: 1rem 1.5rem;
  border-radius: 16px;
  border: 1px solid rgba(102, 126, 234, 0.2);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  min-width: 180px;
  z-index: 100;
  
  @media (max-width: 768px) {
    top: 1rem;
    right: 1rem;
    padding: 0.75rem 1.25rem;
    min-width: 150px;
  }
  
  .status-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 0.5rem;
    font-weight: 600;
  }
  
  .status-value {
    font-size: 1rem;
    color: ${props => {
      switch(props.state) {
        case 'listening': return '#fbbf24';
        case 'processing': return '#f59e0b';
        case 'speaking': return '#667eea';
        default: return '#10b981';
      }
    }};
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    
    @media (max-width: 768px) {
      font-size: 0.9rem;
    }
    
    &::before {
      content: '';
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
      animation: ${props => (props.state !== 'idle' ? pulse : 'none')} 2s infinite;
    }
  }
  
  .processing-detail {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.6);
    margin-top: 0.5rem;
    animation: ${processingGlow} 1.5s infinite;
  }
`;

const AICore = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 240px;
  height: 240px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 
    0 0 60px rgba(102, 126, 234, 0.4),
    inset 0 0 60px rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ${props => 
    props.isProcessing ? processingGlow :
    props.isSpeaking ? pulse :
    'none'
  } ${props => props.isProcessing ? '1s' : '2s'} infinite ease-in-out;
  
  @media (max-width: 768px) {
    width: 200px;
    height: 200px;
  }
  
  &:hover {
    transform: translate(-50%, -50%) scale(1.1);
    box-shadow: 
      0 0 100px rgba(102, 126, 234, 0.6),
      inset 0 0 80px rgba(255, 255, 255, 0.15);
  }
  
  &:active {
    transform: translate(-50%, -50%) scale(0.95);
  }
  
  .icon {
    font-size: 5rem;
    filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.8));
    
    @media (max-width: 768px) {
      font-size: 4rem;
    }
  }
`;

const ResponseBubble = styled.div`
  position: absolute;
  bottom: 6rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(30px);
  padding: 2rem;
  border-radius: 24px;
  max-width: 90%;
  width: 700px;
  box-shadow: 
    0 20px 60px rgba(0, 0, 0, 0.5),
    0 0 40px rgba(102, 126, 234, 0.3);
  border: 1px solid rgba(102, 126, 234, 0.3);
  animation: ${fadeIn} 0.4s cubic-bezier(0.4, 0, 0.2, 1), 
             ${props => props.isSpeaking ? pulse : 'none'} 2s infinite;
  z-index: 90;
  
  @media (max-width: 768px) {
    left: 1rem;
    right: 1rem;
    transform: none;
    width: auto;
    max-width: none;
    padding: 1.5rem;
    bottom: 5rem;
  }

  .badge {
    position: absolute;
    top: 1rem;
    left: 1rem;
    background: rgba(102, 126, 234, 0.2);
    color: #667eea;
    padding: 0.4rem 0.8rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .text {
    color: white;
    font-size: 1.05rem;
    line-height: 1.7;
    margin: 0;
    white-space: pre-line;
    padding-top: 0.5rem;
    
    @media (max-width: 768px) {
      font-size: 0.95rem;
      line-height: 1.6;
    }
  }
  
  .close-btn {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1.2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    
    &:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: rotate(90deg);
    }
  }
`;

const InfoFooter = styled.footer`
  position: absolute;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.85rem;
  max-width: 500px;
  padding: 0 2rem;
  
  @media (max-width: 768px) {
    bottom: 1rem;
    font-size: 0.8rem;
    padding: 0 1rem;
  }
  
  .instruction {
    font-weight: 500;
    margin-bottom: 0.3rem;
  }
  
  .hint {
    font-size: 0.75rem;
    opacity: 0.7;
  }
`;

// ===== MAIN COMPONENT =====

export default function CharacterView({ onMessage }) {
  const container = useRef();
  const [loading, setLoading] = useState(true);
  const [aiText, setAiText] = useState("");
  const [showResponse, setShowResponse] = useState(false);
  const [aiState, setAiState] = useState('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionId] = useState(() => 
    `session_foxmandal_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  );
  const [pendingMessage, setPendingMessage] = useState(null);
  
  const { listen, listening, stop } = useSpeechRecognition({ 
    onResult: handleVoiceCommand 
  });

  // Voice command handler with re-engagement support
  async function handleVoiceCommand(text) {
    if (!text?.trim()) return;
    
    console.log('Processing:', text);
    
    setAiState('processing');
    setIsProcessing(true);
    stopTTS();
    stop();
    
    setShowResponse(true);
    setAiText('Analyzing your legal query...');

    try {
      // If there's a pending message from re-engagement, process it first
      const messageToProcess = pendingMessage || text.trim();
      setPendingMessage(null);

      const response = await sendMessage(messageToProcess, sessionId);
      
      setIsProcessing(false);
      
      // Handle re-engagement greeting
      if (response.needsFollowUp && response.userMessage) {
        setAiState('speaking');
        setAiText(response.reply);
        await speakResponse(response.reply);
        
        // Store the actual message for next interaction
        setPendingMessage(response.userMessage);
        return;
      }
      
      setAiState('speaking');
      setAiText(response.reply);
      onMessage?.(response.reply);
      
      await speakResponse(response.reply);
      
    } catch (err) {
      console.error('Error:', err);
      setIsProcessing(false);
      setAiState('idle');
      const errorMessage = 'I encountered an issue. Please try again.';
      setAiText(errorMessage);
      await speakResponse(errorMessage);
    }
  }

  // Text-to-speech handler
  const speakResponse = useCallback(async (text) => {
    setIsSpeaking(true);
    setAiState('speaking');
    try {
      await getTTS(text);
    } catch (err) {
      console.error("TTS error:", err);
    } finally {
      setIsSpeaking(false);
      setAiState('idle');
    }
  }, []);

  // Three.js scene
  useEffect(() => {
    const el = container.current;
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(75, el.clientWidth / el.clientHeight, 0.1, 1000);
    camera.position.z = 5;

    const geometry = new THREE.IcosahedronGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0x667eea, 
      transparent: true, 
      opacity: 0.3,
      wireframe: true 
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    function animate() {
      requestAnimationFrame(animate);
      const speed = isProcessing ? 0.02 : 0.008;
      mesh.rotation.x += speed;
      mesh.rotation.y += speed;
      renderer.render(scene, camera);
    }

    animate();
    setLoading(false);

    return () => {
      if (el.contains(renderer.domElement)) {
        el.removeChild(renderer.domElement);
      }
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, [isProcessing]);

  // AI core click handler
  const handleAIClick = () => {
    if (aiState === 'processing') return;
    
    if (aiState === 'listening' || aiState === 'speaking') {
      stopTTS();
      stop();
      setAiState('idle');
      setIsSpeaking(false);
      setIsProcessing(false);
    } else {
      setAiState('listening');
      listen({ interimResults: false });
    }
  };

  // Status text
  const getStatusText = () => {
    const labels = {
      idle: 'Ready',
      listening: 'Listening',
      processing: 'Processing',
      speaking: 'Speaking'
    };
    return labels[aiState];
  };

  return (
    <>
      <GlobalStyles />
      <Container ref={container}>
        <Header>
          <Logo>
            <div className="brand">FoxMandal Smart AI</div>
            <div className="tagline">Intelligent Legal Assistant</div>
          </Logo>
        </Header>
        
        <StatusPanel state={aiState}>
          <div className="status-label">System Status</div>
          <div className="status-value">
            {getStatusText()}
          </div>
          {isProcessing && (
            <div className="processing-detail">
              Analyzing legal query...
            </div>
          )}
        </StatusPanel>

        <AICore
          isSpeaking={isSpeaking}
          isProcessing={isProcessing}
          onClick={handleAIClick}
          title={`Click to ${aiState === 'idle' ? 'start' : 'stop'}`}
        >
          <div className="icon">⚖️</div>
        </AICore>

        {showResponse && (
          <ResponseBubble isSpeaking={isSpeaking}>
            <div className="badge">Smart AI</div>
            <p className="text">{aiText}</p>
            <button 
              className="close-btn" 
              onClick={() => {
                setShowResponse(false);
                stopTTS();
                setIsSpeaking(false);
              }}
              aria-label="Close"
            >
              ×
            </button>
          </ResponseBubble>
        )}
        
        <InfoFooter>
          <div className="instruction">
            Click the AI core to ask your legal question
          </div>
          <div className="hint">
            Speak clearly for best results
          </div>
        </InfoFooter>
      </Container>
    </>
  );
}