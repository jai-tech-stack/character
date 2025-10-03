// ⚡ ULTRA-FAST CharacterView - Instant Feedback
import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import styled, { keyframes, createGlobalStyle } from "styled-components";
import { useSpeechRecognition } from "react-speech-kit";
import { sendMessage, getTTS, stopTTS, generateAIIntroduction } from "../api/chatApi";

const morphBackground = keyframes`
  0%, 100% { background: radial-gradient(circle at 20% 50%, #667eea 0%, #764ba2 50%, #1e3a8a 100%); }
  50% { background: radial-gradient(circle at 80% 20%, #764ba2 0%, #1e3a8a 50%, #667eea 100%); }
`;

const agenticPulse = keyframes`
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.7); }
  50% { transform: scale(1.05); box-shadow: 0 0 0 15px rgba(102, 126, 234, 0); }
`;

const processingIndicator = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
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
  animation: ${morphBackground} 12s infinite ease-in-out;
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
  } ${props => props.isProcessing ? '1s' : '2s'} infinite ease-in-out;
  box-shadow: 0 0 50px rgba(102, 126, 234, 0.5);
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translate(-50%, -50%) scale(1.05);
    box-shadow: 0 0 80px rgba(102, 126, 234, 0.7);
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
    &::after { font-size: 3rem; }
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
  min-width: 180px;
  z-index: 100;
  
  .status-title {
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #667eea;
    font-size: 0.95rem;
  }
  
  .status-text {
    font-size: 0.85rem;
    opacity: 0.9;
  }
  
  .response-time {
    font-size: 0.75rem;
    color: #fbbf24;
    margin-top: 0.3rem;
  }
  
  @media (max-width: 768px) {
    top: 1rem;
    right: 1rem;
    padding: 0.8rem 1.2rem;
    min-width: 140px;
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
  padding: 1.5rem 2rem;
  border-radius: 25px;
  max-width: 80vw;
  width: auto;
  min-width: 300px;
  box-shadow: 0 15px 50px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(102, 126, 234, 0.4);
  z-index: 90;
  
  @media (max-width: 768px) {
    left: 1rem;
    right: 1rem;
    transform: none;
    max-width: none;
    padding: 1.2rem 1.5rem;
    bottom: 6rem;
  }

  .response-text {
    font-size: 1rem;
    line-height: 1.5;
    margin: 0;
    text-align: left;
    
    @media (max-width: 768px) {
      font-size: 0.95rem;
    }
  }
  
  .close-btn {
    position: absolute;
    top: 0.8rem;
    right: 0.8rem;
    background: rgba(102, 126, 234, 0.2);
    border: none;
    color: white;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    
    &:hover {
      background: rgba(102, 126, 234, 0.5);
      transform: scale(1.1);
    }
  }
  
  .ai-badge {
    position: absolute;
    top: 0.8rem;
    left: 0.8rem;
    font-size: 0.75rem;
    background: rgba(102, 126, 234, 0.3);
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 8px;
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
  padding: 1rem 1.2rem;
  border-radius: 15px;
  border: 1px solid rgba(102, 126, 234, 0.3);
  max-width: 280px;
  z-index: 100;
  
  @media (max-width: 768px) {
    display: none;
  }
  
  .info-title {
    font-weight: 600;
    margin-bottom: 0.4rem;
    color: #fbbf24;
    font-size: 0.9rem;
  }
  
  .info-text {
    font-size: 0.8rem;
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
  const [responseTime, setResponseTime] = useState(null);
  const [sessionId] = useState(() => `session_fast_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
  
  const { listen, listening, stop } = useSpeechRecognition({ 
    onResult: handleVoiceCommand 
  });

  // ⚡ INSTANT FEEDBACK - Show "Processing" immediately
  async function handleVoiceCommand(text) {
    if (!text?.trim()) return;
    
    const startTime = Date.now();
    console.log('⚡ Processing:', text);
    
    // INSTANT FEEDBACK
    setAiState('processing');
    setIsProcessing(true);
    setShowResponse(true);
    setAiText('Processing...');
    stopTTS();
    stop();

    try {
      // Single fast API call
      const response = await sendMessage(text.trim(), sessionId, 'fast');
      
      const elapsed = Date.now() - startTime;
      console.log(`⚡ Response in ${elapsed}ms`);
      
      setIsProcessing(false);
      setAiState('speaking');
      setAiText(response.reply);
      setResponseTime(elapsed);
      onMessage?.(response.reply);
      
      await speakResponse(response.reply);
      
    } catch (err) {
      console.error('AI error:', err);
      setIsProcessing(false);
      setAiState('idle');
      const errorMsg = "I'm having trouble. Could you try again?";
      setAiText(errorMsg);
      await speakResponse(errorMsg);
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

  // LIGHTWEIGHT 3D (No complex geometries)
  useEffect(() => {
    const el = container.current;
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true }); // Antialias off for speed
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Lower pixel ratio
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(75, el.clientWidth / el.clientHeight, 0.1, 1000);
    camera.position.z = 5;

    // Simpler geometry for performance
    const geometry = new THREE.IcosahedronGeometry(1, 0); // Detail level 0 = faster
    const material = new THREE.MeshBasicMaterial({ 
      color: 0x667eea, 
      transparent: true, 
      opacity: 0.3,
      wireframe: true 
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let animationId;
    function animate() {
      animationId = requestAnimationFrame(animate);
      const speed = isProcessing ? 0.02 : 0.008;
      
      mesh.rotation.x += speed;
      mesh.rotation.y += speed;
      
      renderer.render(scene, camera);
    }

    animate();
    setLoading(false);

    return () => {
      cancelAnimationFrame(animationId);
      if (el.contains(renderer.domElement)) {
        el.removeChild(renderer.domElement);
      }
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, [isProcessing]);

  // WELCOME MESSAGE (Load async, don't block)
  useEffect(() => {
    const loadWelcome = async () => {
      try {
        const greeting = await generateAIIntroduction(sessionId);
        // Don't show automatically - wait for user to click
      } catch (error) {
        console.warn('Welcome message failed');
      }
    };
    loadWelcome();
  }, [sessionId]);

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
    if (isProcessing) return 'Thinking...';
    if (listening) return 'Listening...';
    if (isSpeaking) return 'Speaking...';
    return 'Ready';
  };

  return (
    <>
      <GlobalStyles />
      <Container ref={container}>
        <BrandingBar>
          <div className="logo">FoxMandal AI</div>
          <div className="tagline">⚡ Lightning Fast Responses</div>
        </BrandingBar>
        
        <StatusDisplay>
          <div className="status-title">Status</div>
          <div className="status-text">{getStatusText()}</div>
          {responseTime && !isProcessing && (
            <div className="response-time">⚡ {responseTime}ms</div>
          )}
        </StatusDisplay>

        <AICore
          isSpeaking={isSpeaking}
          isProcessing={isProcessing}
          onClick={handleAIClick}
        />

        {showResponse && (
          <ResponseBubble>
            <div className="ai-badge">Fast AI</div>
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
          <div className="info-title">💡 Quick Start</div>
          <div className="info-text">
            Click the AI to ask legal questions. Get instant answers in under 2 seconds!
          </div>
        </InfoBox>
      </Container>
    </>
  );
}