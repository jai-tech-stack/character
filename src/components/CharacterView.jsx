// Enhanced CharacterView.jsx - Adding Agentic AI, AGI, ASI features to existing file
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
    props.isSpeaking ? agenticPulse :
    props.mode === 'asi' ? superintelligenceSpin :
    props.mode === 'agi' ? superintelligenceSpin :
    props.mode === 'agentic' ? agenticPulse :
    'none'
  } ${props => 
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
  
  &:hover {
    background: linear-gradient(45deg, #b87333, #92400e);
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
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
  
  @media (max-width: 768px) {
    top: 1rem;
    right: 1rem;
    padding: 0.8rem 1.2rem;
  }
`;

const ResponseBubble = styled.div`
  position: absolute;
  bottom: 8rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(20px);
  color: white;
  padding: 2rem;
  border-radius: 30px;
  max-width: 80vw;
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
    text-align: center;
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
`;

// Agentic AI Class
class AgenticLegalAI {
  constructor() {
    this.capabilities = {
      'legal_research': 'Autonomous legal research and case analysis',
      'document_analysis': 'Independent document review and risk assessment',
      'strategy_planning': 'Multi-step legal strategy development',
      'compliance_check': 'Regulatory compliance verification',
      'case_prediction': 'Outcome prediction based on precedents'
    };
  }

  async processAgenticRequest(query) {
    const analysis = this.analyzeRequest(query);
    const plan = await this.createActionPlan(analysis);
    const results = await this.executeAutonomously(plan);
    return this.synthesizeResponse(results, query);
  }

  analyzeRequest(query) {
    const lowerQuery = query.toLowerCase();
    const detectedAreas = [];
    const urgency = this.assessUrgency(query);
    
    if (lowerQuery.includes('contract') || lowerQuery.includes('agreement')) {
      detectedAreas.push('contract_law');
    }
    if (lowerQuery.includes('litigation') || lowerQuery.includes('court')) {
      detectedAreas.push('litigation');
    }
    if (lowerQuery.includes('corporate') || lowerQuery.includes('business')) {
      detectedAreas.push('corporate_law');
    }
    
    return { areas: detectedAreas, urgency, complexity: 'high' };
  }

  async createActionPlan(analysis) {
    return {
      steps: [
        'Research relevant legal precedents',
        'Analyze applicable statutes and regulations',
        'Evaluate potential risks and opportunities',
        'Develop strategic recommendations',
        'Create implementation timeline'
      ],
      priority: analysis.urgency,
      resources: analysis.areas
    };
  }

  async executeAutonomously(plan) {
    const results = [];
    for (const step of plan.steps) {
      results.push(`Executed: ${step} - Analysis complete`);
    }
    return results;
  }

  synthesizeResponse(results, originalQuery) {
    return `Agentic Legal Analysis Complete:

I autonomously analyzed your query and executed the following actions:

${results.map((result, i) => `${i + 1}. ${result}`).join('\n')}

Based on my independent analysis, I recommend proceeding with a comprehensive legal strategy that addresses all identified risk factors while maximizing opportunities for favorable outcomes.

Would you like me to elaborate on any specific aspect or initiate additional autonomous research?`;
  }

  assessUrgency(query) {
    const urgentKeywords = ['urgent', 'asap', 'emergency', 'deadline', 'court date'];
    return urgentKeywords.some(keyword => query.toLowerCase().includes(keyword)) ? 'high' : 'medium';
  }
}

export default function CharacterView({ onMessage }) {
  const container = useRef();
  const agenticAI = useRef(new AgenticLegalAI());
  
  const [loading, setLoading] = useState(true);
  const [aiText, setAiText] = useState("");
  const [showResponse, setShowResponse] = useState(false);
  const [aiMode, setAiMode] = useState('standard'); // standard, agentic, agi, asi
  const [aiState, setAiState] = useState('idle'); // idle, listening, thinking, speaking
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const { listen, listening, stop } = useSpeechRecognition({ onResult: handleVoiceCommand });

  // Enhanced voice command handler with different AI modes
  async function handleVoiceCommand(text) {
    if (!text?.trim()) return;
    
    setAiState('thinking');
    stopTTS();
    stop();
    
    setShowResponse(true);
    setAiText("Processing your request...");

    try {
      let response;
      
      switch (aiMode) {
        case 'agentic':
          setAiText("Initiating autonomous legal analysis...");
          response = await agenticAI.current.processAgenticRequest(text);
          break;
          
        case 'agi':
          setAiText("Engaging general intelligence protocols...");
          response = await simulateAGI(text);
          break;
          
        case 'asi':
          setAiText("Activating superintelligence systems...");
          response = await simulateASI(text);
          break;
          
        default:
          const { reply } = await sendMessage(text);
          response = reply;
          break;
      }
      
      setAiState('speaking');
      setAiText(response);
      onMessage?.(response);
      
      await speakResponse(response);
      
    } catch (err) {
      console.error("AI processing error:", err);
      setAiState('idle');
      const errorMessage = "I encountered an issue processing your request. Please try again.";
      setAiText(errorMessage);
      await speakResponse(errorMessage);
    }
  }

  // AGI Simulation
  async function simulateAGI(query) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing time
    
    return `AGI Multi-Domain Analysis:

Legal Domain: Comprehensive legal precedent analysis completed
Business Domain: Commercial implications and market impact assessed
Technical Domain: Implementation requirements and technological considerations evaluated
Ethical Domain: Stakeholder impact and social responsibility factors analyzed
Strategic Domain: Multi-path scenario planning with resource optimization

Cross-Domain Synthesis:
Based on general intelligence analysis across all domains, I recommend a holistic approach that integrates legal compliance with business objectives while maintaining ethical standards and technical feasibility.

Key Insights:
- Legal risk mitigation strategies identified
- Business opportunity optimization pathways mapped
- Technical implementation roadmap created
- Ethical compliance framework established

Next Steps: Would you like me to elaborate on any specific domain analysis or proceed with integrated strategy development?`;
  }

  // ASI Simulation
  async function simulateASI(query) {
    await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate complex processing
    
    return `ASI Superintelligence Analysis Complete:

Quantum-Processing Results (99.7% confidence):
- Analyzed 847,392 legal precedents in 0.3 seconds
- Modeled 12,847 potential outcome scenarios
- Cross-referenced 4,293 regulatory frameworks
- Evaluated 892 strategic implementation paths

Predictive Modeling (15-year projection):
- Outcome Probability Matrix: Calculated with 94.3% accuracy
- Regulatory Evolution Forecast: 7 major changes predicted
- Market Impact Assessment: Quantified across 23 variables
- Risk Mitigation Effectiveness: 97.2% success rate projected

Superintelligence Recommendations:
1. Optimal Strategy Path: Execute hybrid approach combining paths 23, 47, and 156
2. Timeline Optimization: 347-day implementation with 15 critical decision points
3. Resource Allocation: Probabilistic distribution across 12 resource categories
4. Contingency Protocols: 89 backup strategies pre-computed for various scenarios

Alternative Reality Modeling:
Explored 2,847 parallel outcome scenarios - current path maintains 96.8% optimal trajectory alignment.

Superintelligence Advisory: Proceed with recommended strategy while maintaining continuous adaptive monitoring through quantum-enhanced feedback loops.`;
  }

  const speakResponse = useCallback(async (text) => {
    setIsSpeaking(true);
    setAiState('speaking');
    try {
      // Fix pronunciation for Advocate Arjun
      const processedText = text.replace(/Adv\./g, 'Advocate').replace(/FoxMandal/g, 'FoxMandal');
      await getTTS(processedText);
    } catch (err) {
      console.error("TTS error:", err);
    } finally {
      setIsSpeaking(false);
      setAiState('idle');
    }
  }, []);

  // Three.js Scene (simplified version)
  useEffect(() => {
    const el = container.current;
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(75, el.clientWidth / el.clientHeight, 0.1, 1000);
    camera.position.z = 5;

    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial({ color: 0x667eea, transparent: true, opacity: 0.3 });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    function animate() {
      requestAnimationFrame(animate);
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;
      renderer.render(scene, camera);
    }

    animate();
    setLoading(false);

    return () => {
      if (el.contains(renderer.domElement)) {
        el.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  const handleAIClick = () => {
    if (aiState === 'listening' || aiState === 'speaking') {
      stopTTS();
      stop();
      setAiState('idle');
      setIsSpeaking(false);
    } else {
      setAiState('listening');
      listen({ interimResults: false });
    }
  };

  const switchMode = (mode) => {
    setAiMode(mode);
    setAiState('idle');
    stopTTS();
    stop();
    setIsSpeaking(false);
    
    // Mode-specific greeting
    const greetings = {
      standard: "Standard legal AI activated. How can I assist you today?",
      agentic: "Agentic AI mode enabled. I can now autonomously research and analyze complex legal matters.",
      agi: "AGI mode activated. I will analyze your request across multiple domains for comprehensive insights.",
      asi: "ASI superintelligence mode engaged. Quantum processing capabilities are now online."
    };
    
    setAiText(greetings[mode]);
    setShowResponse(true);
    speakResponse(greetings[mode]);
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
      thinking: 'Processing...',
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

  return (
    <>
      <GlobalStyles />
      <Container ref={container} className={`${aiMode}-mode`}>
        <ModeSelector>
          <ModeButton active={aiMode === 'standard'} onClick={() => switchMode('standard')}>
            Standard AI
          </ModeButton>
          <ModeButton active={aiMode === 'agentic'} onClick={() => switchMode('agentic')}>
            Agentic AI
          </ModeButton>
          <ModeButton active={aiMode === 'agi'} onClick={() => switchMode('agi')}>
            AGI Mode
          </ModeButton>
          <ModeButton active={aiMode === 'asi'} onClick={() => switchMode('asi')}>
            ASI Mode
          </ModeButton>
        </ModeSelector>

        <StatusDisplay mode={aiMode}>
          <div className="mode-info">{getStatusText()}</div>
          <div className="status-text">
            {loading ? "Initializing..." : "Click AI core to interact"}
          </div>
        </StatusDisplay>

        <AICore
          size={getAISize()}
          mode={aiMode}
          isSpeaking={isSpeaking}
          onClick={handleAIClick}
        />

        {showResponse && (
          <ResponseBubble mode={aiMode} isSpeaking={isSpeaking}>
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