// Simplified CharacterView.jsx - Smart AI Only, No Mode Confusion
import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import styled, { keyframes, createGlobalStyle } from "styled-components";
import { useSpeechRecognition } from "react-speech-kit";
import { sendMessage, getTTS, stopTTS } from "../api/chatApi";

const morphBackground = keyframes`
  0% { background: radial-gradient(circle at 20% 50%, #667eea 0%, #764ba2 50%, #1e3a8a 100%); }
  50% { background: radial-gradient(circle at 80% 20%, #764ba2 0%, #1e3a8a 50%, #667eea 100%); }
  100% { background: radial-gradient(circle at 20% 50%, #667eea 0%, #764ba2 50%, #1e3a8a 100%); }
`;

const agenticPulse = keyframes`
  0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.7); }
  50% { transform: scale(1.1); box-shadow: 0 0 0 20px rgba(102, 126, 234, 0.3); }
  100% { transform: scale(1); box-shadow: 0 0 0 40px rgba(102, 126, 234, 0); }
`;

const processingIndicator = keyframes`
  0% { opacity: 0.3; }
  50% { opacity: 1; }
  100% { opacity: 0.3; }
`;

const GlobalStyles = createGlobalStyle`
  * { box-sizing: border-box; }
  body { margin: 0; overflow: hidden; font-family: 'Inter', -apple-system, sans-serif; }
`;

const Container = styled.div`
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #667eea 100%);
  animation: ${morphBackground} 15s infinite ease-in-out;
`;

const BrandingBar = styled.div`
  position: absolute;
  top: 2rem;
  left: 2rem;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  color: white;
  padding: 1rem 1.5rem;
  border-radius: 20px;
  border: 1px solid rgba(102, 126, 234, 0.3);
  z-index: 100;
  
  @media (max-width: 768px) {
    top: 1rem;
    left: 1rem;
    padding: 0.8rem 1.2rem;
  }
  
  .logo {
    font-size: 1.5rem;
    font-weight: 700;
    color: #667eea;
    margin-bottom: 0.3rem;
  }
  
  .tagline {
    font-size: 0.85rem;
    opacity: 0.9;
    color: #fbbf24;
  }
`;

const AICore = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 250px;
  height: 250px;
  border-radius: 50%;
  background: linear-gradient(45deg, #667eea, #764ba2);
  animation: ${props => 
    props.isProcessing ? processingIndicator :
    props.isSpeaking ? agenticPulse :
    'none'
  } ${props => props.isProcessing ? '1.5s' : '2.5s'} infinite ease-in-out;
  box-shadow: 0 0 50px rgba(102, 126, 234, 0.5), inset 0 0 50px rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translate(-50%, -50%) scale(1.1);
    box-shadow: 0 0 100px rgba(102, 126, 234, 0.8);
  }
  
  &::after {
    content: '⚖️';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 4rem;
    filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.8));
  }
  
  @media (max-width: 768px) {
    width: 200px;
    height: 200px;
    
    &::after {
      font-size: 3rem;
    }
  }
`;

const StatusDisplay = styled.div`
  position: absolute;
  top: 2rem;
  right: 2rem;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  color: white;
  padding: 1rem 1.5rem;
  border-radius: 20px;
  border: 1px solid rgba(102, 126, 234, 0.3);
  min-width: 200px;
  z-index: 100;
  
  .status-title {
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #667eea;
    font-size: 1rem;
  }
  
  .status-text {
    font-size: 0.9rem;
    opacity: 0.9;
  }
  
  .processing-info {
    font-size: 0.8rem;
    color: #fbbf24;
    margin-top: 0.5rem;
    animation: ${processingIndicator} 1.5s infinite;
  }
  
  @media (max-width: 768px) {
    top: 1rem;
    right: 1rem;
    padding: 0.8rem 1.2rem;
    min-width: 150px;
  }
`;

const ResponseBubble = styled.div`
  position: absolute;
  bottom: 8rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(30px);
  color: white;
  padding: 2rem;
  border-radius: 30px;
  max-width: 85vw;
  width: auto;
  min-width: 300px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 50px rgba(102, 126, 234, 0.3);
  border: 1px solid rgba(102, 126, 234, 0.5);
  animation: ${props => props.isSpeaking ? agenticPulse : 'none'} 2s infinite;
  z-index: 90;
  
  @media (max-width: 768px) {
    left: 1rem;
    right: 1rem;
    transform: none;
    max-width: none;
    padding: 1.5rem;
    bottom: 6rem;
  }

  .response-text {
    font-size: 1.1rem;
    line-height: 1.6;
    margin: 0;
    text-align: left;
    white-space: pre-line;
    
    @media (max-width: 768px) {
      font-size: 1rem;
    }
  }
  
  .close-btn {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: rgba(102, 126, 234, 0.3);
    border: none;
    color: white;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    
    &:hover {
      background: rgba(102, 126, 234, 0.6);
      transform: scale(1.1);
    }
  }
  
  .ai-badge {
    position: absolute;
    top: 1rem;
    left: 1rem;
    font-size: 0.8rem;
    background: rgba(102, 126, 234, 0.3);
    color: white;
    padding: 0.3rem 0.6rem;
    border-radius: 10px;
    font-weight: 600;
  }
`;

const InfoBox = styled.div`
  position: absolute;
  bottom: 2rem;
  left: 2rem;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  color: white;
  padding: 1rem 1.5rem;
  border-radius: 15px;
  border: 1px solid rgba(102, 126, 234, 0.3);
  max-width: 300px;
  z-index: 100;
  
  @media (max-width: 768px) {
    display: none;
  }
  
  .info-title {
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #fbbf24;
  }
  
  .info-text {
    font-size: 0.85rem;
    line-height: 1.4;
    opacity: 0.9;
  }
`;

export default function CharacterView({ onMessage }) {
  const container = useRef();
  
  const [loading, setLoading] = useState(true);
  const [aiText, setAiText] = useState("");
  const [showResponse, setShowResponse] = useState(false);
  const [aiState, setAiState] = useState('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionId] = useState(() => `session_foxmandal_agentic_${Date.now()}_${Math.random().toString(36).substring(2, 15).toLowerCase()}`);
  
  const { listen, listening, stop } = useSpeechRecognition({ 
    onResult: handleVoiceCommand 
  });

  async function handleVoiceCommand(text) {
    if (!text?.trim()) return;
    
    console.log('Processing with Smart AI:', text);
    
    setAiState('processing');
    setIsProcessing(true);
    stopTTS();
    stop();
    
    setShowResponse(true);
    setAiText('Processing your legal query...');

    try {
      // Single fast API call
      const response = await sendMessage(text.trim(), sessionId, 'agentic');
      
      setIsProcessing(false);
      setAiState('speaking');
      setAiText(response.reply);
      onMessage?.(response.reply);
      
      console.log('Smart AI response generated');
      
      await speakResponse(response.reply);
      
    } catch (err) {
      console.error('Smart AI error:', err);
      setIsProcessing(false);
      setAiState('idle');
      const errorMessage = 'I encountered an issue processing your request. Please try again.';
      setAiText(errorMessage);
      await speakResponse(errorMessage);
    }
  }

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
      opacity: 0.4,
      wireframe: true 
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    function animate() {
      requestAnimationFrame(animate);
      const speed = isProcessing ? 0.03 : 0.01;
      
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

  const handleAIClick = () => {
    if (aiState === 'listening' || aiState === 'speaking') {
      stopTTS();
      stop();
      setAiState('idle');
      setIsSpeaking(false);
      setIsProcessing(false);
    } else if (aiState === 'processing') {
      return; // Can't interrupt
    } else {
      setAiState('listening');
      listen({ interimResults: false });
    }
  };

  const getStatusText = () => {
    const stateLabels = {
      idle: 'Ready to Assist',
      listening: 'Listening...',
      processing: 'Analyzing...',
      speaking: 'Speaking...'
    };
    
    return stateLabels[aiState];
  };

  return (
    <>
      <GlobalStyles />
      <Container ref={container}>
        <BrandingBar>
          <div className="logo">FoxMandal Smart AI</div>
          <div className="tagline">Intelligent Legal Assistant</div>
        </BrandingBar>
        
        <StatusDisplay>
          <div className="status-title">Status</div>
          <div className="status-text">
            {loading ? "Initializing..." : 
             isProcessing ? "Processing" :
             getStatusText()}
          </div>
          {isProcessing && (
            <div className="processing-info">Smart AI analyzing your query...</div>
          )}
        </StatusDisplay>

        <AICore
          isSpeaking={isSpeaking}
          isProcessing={isProcessing}
          onClick={handleAIClick}
        />

        {showResponse && (
          <ResponseBubble isSpeaking={isSpeaking}>
            <div className="ai-badge">Smart AI</div>
            <p className="response-text">{aiText}</p>
            <button 
              className="close-btn" 
              onClick={() => {
                setShowResponse(false);
                stopTTS();
                setIsSpeaking(false);
              }}
            >
              ×
            </button>
          </ResponseBubble>
        )}
        
        <InfoBox>
          <div className="info-title">💡 How to Use</div>
          <div className="info-text">
            Click the AI core to start voice interaction. Ask any legal question and get fast, intelligent analysis from our advanced legal assistant.
          </div>
        </InfoBox>
      </Container>
    </>
  );
}