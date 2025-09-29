// Complete Real AI Mode CharacterView.jsx - Genuine AI differentiation
import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import styled, { keyframes, createGlobalStyle } from "styled-components";
import { useSpeechRecognition } from "react-speech-kit";
import { sendMessage, getTTS, stopTTS } from "../api/chatApi";

// Enhanced animations for different AI modes
const morphBackground = keyframes`
  0% { background: radial-gradient(circle at 20% 50%, #667eea 0%, #764ba2 50%, #1e3a8a 100%); }
  25% { background: radial-gradient(circle at 80% 20%, #764ba2 0%, #1e3a8a 50%, #667eea 100%); }
  50% { background: radial-gradient(circle at 50% 80%, #1e3a8a 0%, #667eea 50%, #764ba2 100%); }
  75% { background: radial-gradient(circle at 10% 10%, #667eea 0%, #1e3a8a 50%, #764ba2 100%); }
  100% { background: radial-gradient(circle at 20% 50%, #667eea 0%, #764ba2 50%, #1e3a8a 100%); }
`;

const agenticPulse = keyframes`
  0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(184, 115, 51, 0.7); }
  50% { transform: scale(1.1); box-shadow: 0 0 0 20px rgba(184, 115, 51, 0.3); }
  100% { transform: scale(1); box-shadow: 0 0 0 40px rgba(184, 115, 51, 0); }
`;

const superintelligenceSpin = keyframes`
  0% { transform: rotate(0deg) scale(1); }
  25% { transform: rotate(90deg) scale(1.05); }
  50% { transform: rotate(180deg) scale(1.1); }
  75% { transform: rotate(270deg) scale(1.05); }
  100% { transform: rotate(360deg) scale(1); }
`;

const processingIndicator = keyframes`
  0% { opacity: 0.3; }
  50% { opacity: 1; }
  100% { opacity: 0.3; }
`;

const fadeIn = keyframes`from { opacity:0 } to { opacity:1 }`;

const GlobalStyles = createGlobalStyle`
  * { box-sizing: border-box; }
  body { margin: 0; overflow: hidden; font-family: 'Inter', -apple-system, sans-serif; }
`;

const Container = styled.div`
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  animation: ${morphBackground} 15s infinite ease-in-out;
  transition: background 0.8s ease;
  
  &.standard-mode { 
    background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
  }
  
  &.agentic-mode { 
    background: linear-gradient(135deg, #7c2d12 0%, #92400e 50%, #b87333 100%);
    animation: ${morphBackground} 8s infinite ease-in-out;
  }
  
  &.agi-mode { 
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    animation: ${morphBackground} 12s infinite ease-in-out;
  }
  
  &.asi-mode { 
    background: radial-gradient(circle at 50% 50%, #0a0a23 0%, #1a1a40 50%, #2d2d7c 100%);
    animation: ${morphBackground} 20s infinite linear;
  }
`;

// Enhanced AI Core with different modes
const AICore = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: ${props => props.size || '200px'};
  height: ${props => props.size || '200px'};
  border-radius: 50%;
  background: ${props => 
    props.mode === 'asi' ? 'linear-gradient(45deg, #2d2d7c, #4a4af5, #7c7cff)' :
    props.mode === 'agi' ? 'linear-gradient(45deg, #0f3460, #1976d2, #42a5f5)' :
    props.mode === 'agentic' ? 'linear-gradient(45deg, #b87333, #f57c00, #ffb74d)' :
    'linear-gradient(45deg, #667eea, #764ba2)'
  };
  animation: ${props => 
    props.isProcessing ? processingIndicator :
    props.isSpeaking ? agenticPulse :
    props.mode === 'asi' ? superintelligenceSpin :
    props.mode === 'agi' ? superintelligenceSpin :
    props.mode === 'agentic' ? agenticPulse :
    'none'
  } ${props => 
    props.isProcessing ? '1.5s' :
    props.mode === 'asi' ? '1s' :
    props.mode === 'agi' ? '2s' :
    '3s'
  } infinite ease-in-out;
  box-shadow: 
    0 0 50px ${props => 
      props.mode === 'asi' ? 'rgba(125, 125, 255, 0.5)' :
      props.mode === 'agi' ? 'rgba(25, 118, 210, 0.5)' :
      props.mode === 'agentic' ? 'rgba(184, 115, 51, 0.5)' :
      'rgba(102, 126, 234, 0.3)'
    },
    inset 0 0 50px rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translate(-50%, -50%) scale(1.1);
    box-shadow: 
      0 0 100px ${props => 
        props.mode === 'asi' ? 'rgba(125, 125, 255, 0.8)' :
        props.mode === 'agi' ? 'rgba(25, 118, 210, 0.8)' :
        props.mode === 'agentic' ? 'rgba(184, 115, 51, 0.8)' :
        'rgba(102, 126, 234, 0.5)'
      };
  }
  
  &::after {
    content: ${props => 
      props.mode === 'asi' ? '"🧠"' :
      props.mode === 'agi' ? '"🤖"' :
      props.mode === 'agentic' ? '"🔬"' :
      '"⚖️"'
    };
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 4rem;
    filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.8));
  }
`;

const ModeSelector = styled.div`
  position: absolute;
  top: 2rem;
  left: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  z-index: 100;
  
  @media (max-width: 768px) {
    top: 1rem;
    left: 1rem;
    flex-direction: row;
    flex-wrap: wrap;
  }
`;

const ModeButton = styled.button`
  background: ${props => props.active ? 
    'linear-gradient(45deg, #b87333, #92400e)' : 
    'rgba(255, 255, 255, 0.1)'
  };
  border: 2px solid ${props => props.active ? '#b87333' : 'rgba(255, 255, 255, 0.3)'};
  color: white;
  padding: 0.8rem 1.5rem;
  border-radius: 25px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  min-width: 120px;
  position: relative;
  
  &:hover {
    background: linear-gradient(45deg, #b87333, #92400e);
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  @media (max-width: 768px) {
    padding: 0.6rem 1rem;
    font-size: 0.8rem;
    min-width: 100px;
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
  border: 1px solid rgba(184, 115, 51, 0.3);
  min-width: 200px;
  
  .mode-info {
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: ${props => 
      props.mode === 'asi' ? '#7c7cff' :
      props.mode === 'agi' ? '#42a5f5' :
      props.mode === 'agentic' ? '#ffb74d' :
      '#667eea'
    };
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
  box-shadow: 
    0 20px 60px rgba(0, 0, 0, 0.5),
    0 0 50px ${props => 
      props.mode === 'asi' ? 'rgba(125, 125, 255, 0.3)' :
      props.mode === 'agi' ? 'rgba(25, 118, 210, 0.3)' :
      props.mode === 'agentic' ? 'rgba(184, 115, 51, 0.3)' :
      'rgba(102, 126, 234, 0.3)'
    };
  border: 1px solid ${props => 
    props.mode === 'asi' ? 'rgba(125, 125, 255, 0.5)' :
    props.mode === 'agi' ? 'rgba(25, 118, 210, 0.5)' :
    props.mode === 'agentic' ? 'rgba(184, 115, 51, 0.5)' :
    'rgba(102, 126, 234, 0.5)'
  };
  animation: ${props => props.isSpeaking ? agenticPulse : 'none'} 2s infinite;
  z-index: 90;
  
  @media (max-width: 768px) {
    left: 1rem;
    right: 1rem;
    transform: none;
    max-width: none;
    padding: 1.5rem;
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
    background: rgba(184, 115, 51, 0.3);
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
      background: rgba(184, 115, 51, 0.6);
      transform: scale(1.1);
    }
  }
  
  .ai-mode-indicator {
    position: absolute;
    top: 1rem;
    left: 1rem;
    font-size: 0.8rem;
    background: ${props => 
      props.mode === 'asi' ? 'rgba(125, 125, 255, 0.3)' :
      props.mode === 'agi' ? 'rgba(25, 118, 210, 0.3)' :
      props.mode === 'agentic' ? 'rgba(184, 115, 51, 0.3)' :
      'rgba(102, 126, 234, 0.3)'
    };
    color: white;
    padding: 0.3rem 0.6rem;
    border-radius: 10px;
    font-weight: 600;
  }
`;

export default function CharacterView({ onMessage }) {
  const container = useRef();
  
  const [loading, setLoading] = useState(true);
  const [aiText, setAiText] = useState("");
  const [showResponse, setShowResponse] = useState(false);
  const [aiMode, setAiMode] = useState('standard'); // standard, agentic, agi, asi
  const [aiState, setAiState] = useState('idle'); // idle, listening, processing, speaking
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionId] = useState(() => `session_foxmandal_${aiMode}_${Date.now()}_${Math.random().toString(36).substring(2, 15).toLowerCase()}`);
  
  const { listen, listening, stop } = useSpeechRecognition({ 
    onResult: handleVoiceCommand 
  });

  // Real AI voice command handler with genuine mode differences
  async function handleVoiceCommand(text) {
    if (!text?.trim()) return;
    
    console.log(`Processing voice command in ${aiMode} mode:`, text);
    
    setAiState('processing');
    setIsProcessing(true);
    stopTTS();
    stop();
    
    setShowResponse(true);
    setAiText(`Processing with ${aiMode.toUpperCase()} AI...`);

    try {
      // Use the real AI processor
      const response = await sendMessage(text.trim(), sessionId, aiMode);
      
      setIsProcessing(false);
      setAiState('speaking');
      setAiText(response.reply);
      onMessage?.(response.reply);
      
      console.log(`${aiMode} mode response generated:`, response.processingType);
      
      await speakResponse(response.reply);
      
    } catch (err) {
      console.error(`${aiMode} AI processing error:`, err);
      setIsProcessing(false);
      setAiState('idle');
      const errorMessage = `I encountered an issue with ${aiMode} processing. Please try again.`;
      setAiText(errorMessage);
      await speakResponse(errorMessage);
    }
  }

  const speakResponse = useCallback(async (text) => {
    setIsSpeaking(true);
    setAiState('speaking');
    try {
      await getTTS(text, aiMode);
    } catch (err) {
      console.error("TTS error:", err);
    } finally {
      setIsSpeaking(false);
      setAiState('idle');
    }
  }, [aiMode]);

  // Three.js Scene with mode-responsive effects
  useEffect(() => {
    const el = container.current;
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(75, el.clientWidth / el.clientHeight, 0.1, 1000);
    camera.position.z = 5;

    // Create mode-specific geometries
    let geometry, material, mesh;
    
    switch(aiMode) {
      case 'asi':
        geometry = new THREE.IcosahedronGeometry(1, 2);
        material = new THREE.MeshBasicMaterial({ 
          color: 0x4a4af5, 
          transparent: true, 
          opacity: 0.4,
          wireframe: true 
        });
        break;
      case 'agi':
        geometry = new THREE.OctahedronGeometry(1, 1);
        material = new THREE.MeshBasicMaterial({ 
          color: 0x1976d2, 
          transparent: true, 
          opacity: 0.4 
        });
        break;
      case 'agentic':
        geometry = new THREE.TetrahedronGeometry(1, 1);
        material = new THREE.MeshBasicMaterial({ 
          color: 0xf57c00, 
          transparent: true, 
          opacity: 0.4 
        });
        break;
      default:
        geometry = new THREE.BoxGeometry();
        material = new THREE.MeshBasicMaterial({ 
          color: 0x667eea, 
          transparent: true, 
          opacity: 0.3 
        });
    }
    
    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const animationSpeed = {
      'asi': 0.02,
      'agi': 0.015,
      'agentic': 0.01,
      'standard': 0.005
    };

    function animate() {
      requestAnimationFrame(animate);
      const speed = animationSpeed[aiMode] || 0.005;
      
      if (isProcessing) {
        mesh.rotation.x += speed * 3;
        mesh.rotation.y += speed * 3;
        mesh.rotation.z += speed * 3;
      } else {
        mesh.rotation.x += speed;
        mesh.rotation.y += speed;
      }
      
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
  }, [aiMode, isProcessing]);

  const handleAIClick = () => {
    if (aiState === 'listening' || aiState === 'speaking') {
      stopTTS();
      stop();
      setAiState('idle');
      setIsSpeaking(false);
      setIsProcessing(false);
    } else if (aiState === 'processing') {
      // Can't interrupt processing
      return;
    } else {
      setAiState('listening');
      listen({ interimResults: false });
    }
  };

  const switchMode = async (mode) => {
    if (isProcessing) return; // Prevent mode switching during processing
    
    setAiMode(mode);
    setAiState('idle');
    stopTTS();
    stop();
    setIsSpeaking(false);
    setIsProcessing(false);
    
    // Real mode-specific greeting with actual AI processing
    const modeGreeting = `Hello! ${mode.toUpperCase()} mode is now active. Ask me a legal question to see the difference in my processing approach.`;
    
    setAiText(modeGreeting);
    setShowResponse(true);
    
    try {
      // Get a real AI-generated mode introduction
      const response = await sendMessage(
        `Introduce yourself as Advocate Arjun in ${mode} mode and explain your capabilities`,
        sessionId,
        mode
      );
      
      setAiText(response.reply);
      await speakResponse(response.reply);
    } catch (error) {
      console.error('Mode introduction error:', error);
      await speakResponse(modeGreeting);
    }
  };

  const getStatusText = () => {
    const modeLabels = {
      standard: 'Standard AI',
      agentic: 'Agentic Agent',
      agi: 'General Intelligence',
      asi: 'Superintelligence'
    };
    
    const stateLabels = {
      idle: 'Ready',
      listening: 'Listening...',
      processing: 'Processing...',
      speaking: 'Speaking...'
    };
    
    return `${modeLabels[aiMode]} - ${stateLabels[aiState]}`;
  };

  const getAISize = () => {
    switch (aiMode) {
      case 'asi': return '350px';
      case 'agi': return '300px';
      case 'agentic': return '250px';
      default: return '200px';
    }
  };

  const getProcessingInfo = () => {
    if (!isProcessing) return null;
    
    const processingMessages = {
      'asi': 'Running probabilistic analysis...',
      'agi': 'Analyzing across multiple domains...',
      'agentic': 'Executing autonomous research...',
      'standard': 'Processing legal consultation...'
    };
    
    return processingMessages[aiMode];
  };

  return (
    <>
      <GlobalStyles />
      <Container ref={container} className={`${aiMode}-mode`}>
        <ModeSelector>
          <ModeButton 
            active={aiMode === 'standard'} 
            onClick={() => switchMode('standard')}
            disabled={isProcessing}
          >
            Standard AI
          </ModeButton>
          <ModeButton 
            active={aiMode === 'agentic'} 
            onClick={() => switchMode('agentic')}
            disabled={isProcessing}
          >
            Agentic AI
          </ModeButton>
          <ModeButton 
            active={aiMode === 'agi'} 
            onClick={() => switchMode('agi')}
            disabled={isProcessing}
          >
            AGI Mode
          </ModeButton>
          <ModeButton 
            active={aiMode === 'asi'} 
            onClick={() => switchMode('asi')}
            disabled={isProcessing}
          >
            ASI Mode
          </ModeButton>
        </ModeSelector>

        <StatusDisplay mode={aiMode}>
          <div className="mode-info">{getStatusText()}</div>
          <div className="status-text">
            {loading ? "Initializing..." : 
             isProcessing ? "AI Processing Active" :
             "Click AI core to interact"}
          </div>
          {isProcessing && (
            <div className="processing-info">{getProcessingInfo()}</div>
          )}
        </StatusDisplay>

        <AICore
          size={getAISize()}
          mode={aiMode}
          isSpeaking={isSpeaking}
          isProcessing={isProcessing}
          onClick={handleAIClick}
        />

        {showResponse && (
          <ResponseBubble mode={aiMode} isSpeaking={isSpeaking}>
            <div className="ai-mode-indicator">{aiMode.toUpperCase()}</div>
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
      </Container>
    </>
  );
}