// 🔥 FIXED CharacterView.jsx - ChatGPT-Style Natural Conversation
import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import styled, { keyframes, createGlobalStyle } from "styled-components";
import { useSpeechRecognition } from "react-speech-kit";
import { sendMessage, getTTS, stopTTS, generateAIIntroduction, isTTSSpeaking } from "../api/chatApi";

const morphBackground = keyframes`
  0%, 100% { background: radial-gradient(circle at 20% 50%, #667eea 0%, #764ba2 50%, #1e3a8a 100%); }
  50% { background: radial-gradient(circle at 80% 20%, #764ba2 0%, #1e3a8a 50%, #667eea 100%); }
`;

const agenticPulse = keyframes`
  0%, 100% { transform: scale(1); box-shadow: 0 0 30px rgba(102, 126, 234, 0.6); }
  50% { transform: scale(1.08); box-shadow: 0 0 50px rgba(102, 126, 234, 0.9); }
`;

const listeningPulse = keyframes`
  0%, 100% { transform: scale(1); box-shadow: 0 0 30px rgba(251, 191, 36, 0.6); }
  50% { transform: scale(1.12); box-shadow: 0 0 60px rgba(251, 191, 36, 1); }
`;

const processingIndicator = keyframes`
  0%, 100% { opacity: 0.5; transform: rotate(0deg); }
  50% { opacity: 1; transform: rotate(180deg); }
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
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(15px);
  color: white;
  padding: 1.2rem 1.8rem;
  border-radius: 24px;
  border: 1px solid rgba(102, 126, 234, 0.4);
  z-index: 100;
  
  @media (max-width: 768px) {
    top: 1rem;
    left: 1rem;
    padding: 0.9rem 1.3rem;
  }
  
  .logo {
    font-size: 1.6rem;
    font-weight: 700;
    color: #667eea;
    margin-bottom: 0.4rem;
    text-shadow: 0 0 10px rgba(102, 126, 234, 0.5);
  }
  
  .tagline {
    font-size: 0.9rem;
    opacity: 0.95;
    color: #fbbf24;
  }
`;

const AICore = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: ${props => props.isActive ? '280px' : '250px'};
  height: ${props => props.isActive ? '280px' : '250px'};
  border-radius: 50%;
  background: ${props => 
    props.listening ? 'linear-gradient(45deg, #fbbf24, #f59e0b)' :
    props.isProcessing ? 'linear-gradient(45deg, #8b5cf6, #7c3aed)' :
    'linear-gradient(45deg, #667eea, #764ba2)'
  };
  animation: ${props => 
    props.listening ? listeningPulse :
    props.isProcessing ? processingIndicator :
    props.isSpeaking ? agenticPulse :
    'none'
  } ${props => props.isProcessing ? '2s' : '1.5s'} infinite ease-in-out;
  box-shadow: ${props => 
    props.listening ? '0 0 60px rgba(251, 191, 36, 0.7)' :
    props.isProcessing ? '0 0 60px rgba(139, 92, 246, 0.7)' :
    '0 0 50px rgba(102, 126, 234, 0.6)'
  };
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover {
    transform: translate(-50%, -50%) scale(1.1);
    box-shadow: 0 0 80px rgba(102, 126, 234, 0.9);
  }
  
  &::after {
    content: '${props => 
      props.listening ? '🎤' :
      props.isProcessing ? '⚙️' :
      props.isSpeaking ? '🔊' :
      '⚖️'
    }';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 4.5rem;
    filter: drop-shadow(0 0 25px rgba(255, 255, 255, 0.9));
  }
  
  @media (max-width: 768px) {
    width: ${props => props.isActive ? '220px' : '200px'};
    height: ${props => props.isActive ? '220px' : '200px'};
    &::after { font-size: 3.5rem; }
  }
`;

const StatusDisplay = styled.div`
  position: absolute;
  top: 2rem;
  right: 2rem;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(15px);
  color: white;
  padding: 1.2rem 1.8rem;
  border-radius: 24px;
  border: 1px solid rgba(102, 126, 234, 0.4);
  min-width: 200px;
  z-index: 100;
  
  .status-title {
    font-weight: 600;
    margin-bottom: 0.6rem;
    color: #667eea;
    font-size: 1rem;
  }
  
  .status-text {
    font-size: 0.9rem;
    opacity: 0.95;
    color: ${props => 
      props.listening ? '#fbbf24' :
      props.processing ? '#8b5cf6' :
      '#10b981'
    };
    font-weight: 500;
  }
  
  .response-time {
    font-size: 0.8rem;
    color: #fbbf24;
    margin-top: 0.5rem;
    font-weight: 600;
  }
  
  .conversation-count {
    font-size: 0.75rem;
    color: #94a3b8;
    margin-top: 0.3rem;
  }
  
  @media (max-width: 768px) {
    top: 1rem;
    right: 1rem;
    padding: 0.9rem 1.3rem;
    min-width: 160px;
  }
`;

const ResponseBubble = styled.div`
  position: absolute;
  bottom: 8rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.92);
  backdrop-filter: blur(40px);
  color: white;
  padding: 1.8rem 2.5rem;
  border-radius: 30px;
  max-width: 75vw;
  width: auto;
  min-width: 320px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(102, 126, 234, 0.5);
  z-index: 90;
  animation: slideUp 0.4s ease-out;
  
  @keyframes slideUp {
    from { opacity: 0; transform: translate(-50%, 20px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }
  
  @media (max-width: 768px) {
    left: 1rem;
    right: 1rem;
    transform: none;
    max-width: none;
    padding: 1.5rem 2rem;
    bottom: 6rem;
  }

  .response-text {
    font-size: 1.1rem;
    line-height: 1.6;
    margin: 0;
    text-align: left;
    
    @media (max-width: 768px) {
      font-size: 1rem;
    }
  }
  
  .close-btn {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: rgba(239, 68, 68, 0.2);
    border: none;
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    
    &:hover {
      background: rgba(239, 68, 68, 0.8);
      transform: scale(1.15);
    }
  }
  
  .ai-badge {
    position: absolute;
    top: 1rem;
    left: 1rem;
    font-size: 0.8rem;
    background: rgba(102, 126, 234, 0.4);
    color: white;
    padding: 0.3rem 0.7rem;
    border-radius: 10px;
    font-weight: 600;
  }
`;

const InfoBox = styled.div`
  position: absolute;
  bottom: 2rem;
  left: 2rem;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(15px);
  color: white;
  padding: 1.2rem 1.5rem;
  border-radius: 20px;
  border: 1px solid rgba(102, 126, 234, 0.4);
  max-width: 300px;
  z-index: 100;
  
  @media (max-width: 768px) {
    display: none;
  }
  
  .info-title {
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #fbbf24;
    font-size: 0.95rem;
  }
  
  .info-text {
    font-size: 0.85rem;
    line-height: 1.5;
    opacity: 0.95;
  }
`;

export default function CharacterView({ onMessage }) {
  const container = useRef();
  
  const [aiText, setAiText] = useState("");
  const [showResponse, setShowResponse] = useState(false);
  const [aiState, setAiState] = useState('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [responseTime, setResponseTime] = useState(null);
  const [conversationCount, setConversationCount] = useState(0);
  const [hasIntroduced, setHasIntroduced] = useState(false);
  const [sessionId] = useState(() => `session_voice_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
  
  const { listen, listening, stop } = useSpeechRecognition({ 
    onResult: handleVoiceCommand 
  });

  // 🎤 VOICE COMMAND HANDLER - Natural Flow
  async function handleVoiceCommand(text) {
    if (!text?.trim()) return;
    
    const startTime = Date.now();
    console.log('🎤 User said:', text);
    
    // Stop listening immediately
    stop();
    
    // Update state
    setAiState('processing');
    setIsProcessing(true);
    setShowResponse(true);
    setAiText('Thinking...');
    stopTTS();

    try {
      // Get AI response
      const response = await sendMessage(text.trim(), sessionId, 'smart');
      
      const elapsed = Date.now() - startTime;
      console.log(`⚡ AI responded in ${elapsed}ms`);
      
      setIsProcessing(false);
      setAiState('speaking');
      setAiText(response.reply);
      setResponseTime(elapsed);
      setConversationCount(prev => prev + 1);
      onMessage?.(response.reply);
      
      // 🔥 CRITICAL: Speak COMPLETELY before doing anything else
      await speakResponse(response.reply, response.language);
      
      // After speaking completes, return to idle
      setAiState('idle');
      console.log('✅ Ready for next question');
      
    } catch (err) {
      console.error('AI error:', err);
      setIsProcessing(false);
      setAiState('idle');
      const errorMsg = "I'm sorry, I'm having trouble right now. Could you try again?";
      setAiText(errorMsg);
      await speakResponse(errorMsg);
    }
  }

  // 🔊 TEXT-TO-SPEECH with COMPLETE finish guarantee
  const speakResponse = useCallback(async (text, language = 'en') => {
    setIsSpeaking(true);
    setAiState('speaking');
    console.log('🔊 Starting TTS...');
    
    try {
      // Wait for TTS to COMPLETELY finish
      await getTTS(text, language);
      console.log('✅ TTS completed successfully');
    } catch (err) {
      console.error("TTS error:", err);
    } finally {
      setIsSpeaking(false);
      console.log('🏁 TTS cleanup done');
    }
  }, []);

  // 🎬 AUTO-INTRODUCTION on First Click
  const handleAIClick = async () => {
    console.log('🖱️ AI clicked, current state:', aiState);
    
    // If speaking, allow user to stop
    if (isSpeaking || aiState === 'speaking') {
      console.log('🛑 User stopped AI speech');
      stopTTS();
      setAiState('idle');
      setIsSpeaking(false);
      return;
    }
    
    // If listening, stop listening
    if (listening || aiState === 'listening') {
      console.log('🛑 User stopped listening');
      stop();
      setAiState('idle');
      return;
    }
    
    // Can't interrupt processing
    if (isProcessing || aiState === 'processing') {
      console.log('⚠️ Cannot interrupt processing');
      return;
    }
    
    // FIRST TIME: Auto-introduce
    if (!hasIntroduced) {
      console.log('👋 First time user - introducing...');
      setHasIntroduced(true);
      setAiState('speaking');
      setShowResponse(true);
      
      try {
        const greeting = await generateAIIntroduction(sessionId);
        setAiText(greeting);
        
        // Speak COMPLETE introduction
        await speakResponse(greeting);
        
        // After intro completes, automatically start listening
        console.log('🎤 Auto-starting listening after introduction');
        setAiState('listening');
        listen({ interimResults: false });
        
      } catch (error) {
        console.error('Introduction failed:', error);
        const fallback = "Hello! I'm Advocate Arjun from FoxMandal. How can I help with your legal questions today?";
        setAiText(fallback);
        await speakResponse(fallback);
        
        setAiState('listening');
        listen({ interimResults: false });
      }
      
      return;
    }
    
    // SUBSEQUENT CLICKS: Just start listening
    console.log('🎤 Starting to listen...');
    setAiState('listening');
    listen({ interimResults: false });
  };

  // 🎨 LIGHTWEIGHT 3D BACKGROUND
  useEffect(() => {
    const el = container.current;
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(75, el.clientWidth / el.clientHeight, 0.1, 1000);
    camera.position.z = 5;

    const geometry = new THREE.IcosahedronGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({ 
      color: listening ? 0xfbbf24 : isProcessing ? 0x8b5cf6 : 0x667eea,
      transparent: true, 
      opacity: 0.25,
      wireframe: true 
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let animationId;
    function animate() {
      animationId = requestAnimationFrame(animate);
      const speed = isProcessing ? 0.03 : listening ? 0.02 : 0.008;
      
      mesh.rotation.x += speed;
      mesh.rotation.y += speed;
      
      material.color.setHex(
        listening ? 0xfbbf24 : 
        isProcessing ? 0x8b5cf6 : 
        0x667eea
      );
      
      renderer.render(scene, camera);
    }

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      if (el.contains(renderer.domElement)) {
        el.removeChild(renderer.domElement);
      }
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, [isProcessing, listening]);

  const getStatusText = () => {
    if (isProcessing) return 'Thinking...';
    if (listening) return 'Listening...';
    if (isSpeaking) return 'Speaking...';
    if (!hasIntroduced) return 'Click to start';
    return 'Ready - Click to talk';
  };

  const getInstructionText = () => {
    if (!hasIntroduced) {
      return "Click the AI orb to start your first conversation. I'll introduce myself!";
    }
    if (conversationCount === 0) {
      return "Click the orb to ask your first legal question!";
    }
    return `${conversationCount} question${conversationCount > 1 ? 's' : ''} answered. Click to ask more!`;
  };

  return (
    <>
      <GlobalStyles />
      <Container ref={container}>
        <BrandingBar>
          <div className="logo">FoxMandal AI</div>
          <div className="tagline">⚡ Natural Voice Assistant</div>
        </BrandingBar>
        
        <StatusDisplay listening={listening} processing={isProcessing}>
          <div className="status-title">Status</div>
          <div className="status-text">{getStatusText()}</div>
          {responseTime && !isProcessing && conversationCount > 0 && (
            <div className="response-time">⚡ {responseTime}ms</div>
          )}
          {conversationCount > 0 && (
            <div className="conversation-count">💬 {conversationCount} interaction{conversationCount > 1 ? 's' : ''}</div>
          )}
        </StatusDisplay>

        <AICore
          isSpeaking={isSpeaking}
          isProcessing={isProcessing}
          listening={listening}
          isActive={listening || isSpeaking || isProcessing}
          onClick={handleAIClick}
          title={
            !hasIntroduced ? 'Click to start conversation' :
            listening ? 'Listening... Click to stop' :
            isSpeaking ? 'Speaking... Click to stop' :
            isProcessing ? 'Processing...' :
            'Click to speak'
          }
        />

        {showResponse && aiText && (
          <ResponseBubble>
            <div className="ai-badge">🤖 AI Response</div>
            <p className="response-text">{aiText}</p>
            <button 
              className="close-btn" 
              onClick={() => {
                setShowResponse(false);
                stopTTS();
                setIsSpeaking(false);
                setAiState('idle');
              }}
              title="Close"
            >
              ×
            </button>
          </ResponseBubble>
        )}
        
        <InfoBox>
          <div className="info-title">💡 How It Works</div>
          <div className="info-text">
            {getInstructionText()}
          </div>
        </InfoBox>
      </Container>
    </>
  );
}