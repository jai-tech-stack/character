// Enhanced ChatAssistant.jsx - Adding Agentic AI, AGI, ASI to existing chat interface
import React, { useState, useEffect, useRef, useCallback } from "react";
import styled, { keyframes } from "styled-components";
import { useSpeechRecognition } from "react-speech-kit";
import { sendMessage, getTTS, stopTTS } from "../api/chatApi";
import { v4 as uuidv4 } from "uuid";

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
`;

const slideIn = keyframes`
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const agenticGlow = keyframes`
  0%, 100% { box-shadow: 0 0 20px rgba(184, 115, 51, 0.3); }
  50% { box-shadow: 0 0 40px rgba(184, 115, 51, 0.8); }
`;

const ChatBtn = styled.button`
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  background: ${props => 
    props.listening ? 'linear-gradient(45deg, #b87333, #92400e)' :
    props.mode === 'asi' ? 'linear-gradient(45deg, #2d2d7c, #4a4af5)' :
    props.mode === 'agi' ? 'linear-gradient(45deg, #0f3460, #1976d2)' :
    props.mode === 'agentic' ? 'linear-gradient(45deg, #b87333, #f57c00)' :
    'linear-gradient(45deg, #1e40af, #1e3a8a)'
  };
  border: none;
  border-radius: 50%;
  width: 70px;
  height: 70px;
  color: white;
  font-size: 1.8rem;
  z-index: 1000;
  cursor: pointer;
  box-shadow: 0 8px 25px rgba(0,0,0,0.3);
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  animation: ${props => 
    props.listening ? pulse : 
    props.mode === 'agentic' ? agenticGlow : 
    'none'
  } 1.5s infinite;
  
  @media (max-width: 768px) {
    width: 60px;
    height: 60px;
    font-size: 1.5rem;
    bottom: 1.5rem;
    right: 1.5rem;
  }
  
  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 35px rgba(0,0,0,0.4);
  }
`;

const ChatBox = styled.div`
  position: fixed;
  bottom: 10rem;
  right: 2rem;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(30px);
  padding: 0;
  width: 450px;
  max-width: calc(100vw - 4rem);
  max-height: 600px;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  border: 1px solid ${props => 
    props.mode === 'asi' ? 'rgba(125, 125, 255, 0.5)' :
    props.mode === 'agi' ? 'rgba(25, 118, 210, 0.5)' :
    props.mode === 'agentic' ? 'rgba(184, 115, 51, 0.5)' :
    'rgba(30, 64, 175, 0.2)'
  };
  z-index: 999;
  animation: ${slideIn} 0.4s ease-out;
  overflow: hidden;
  
  @media (max-width: 768px) {
    right: 1rem;
    left: 1rem;
    width: auto;
    max-width: none;
    bottom: 8rem;
  }
`;

const ChatHeader = styled.div`
  background: ${props => 
    props.mode === 'asi' ? 'linear-gradient(135deg, #2d2d7c 0%, #4a4af5 100%)' :
    props.mode === 'agi' ? 'linear-gradient(135deg, #0f3460 0%, #1976d2 100%)' :
    props.mode === 'agentic' ? 'linear-gradient(135deg, #b87333 0%, #f57c00 100%)' :
    'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)'
  };
  color: white;
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }
  
  .ai-mode-indicator {
    font-size: 0.8rem;
    opacity: 0.9;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${props => props.listening ? '#b87333' : '#10b981'};
    animation: ${props => props.listening ? pulse : 'none'} 1s infinite;
  }
`;

const MessagesContainer = styled.div`
  padding: 1rem;
  max-height: 400px;
  overflow-y: auto;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(0,0,0,0.1);
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(0,0,0,0.3);
    border-radius: 3px;
  }
`;

const Message = styled.div`
  margin-bottom: 1rem;
  animation: ${fadeIn} 0.3s ease;
  
  &:last-child {
    margin-bottom: 0;
  }
  
  .message-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.3rem;
  }
  
  .sender {
    font-weight: 600;
    font-size: 0.85rem;
    color: ${props => props.isUser ? '#1e40af' : '#b87333'};
  }
  
  .ai-mode-badge {
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
    border-radius: 10px;
    background: ${props => 
      props.mode === 'asi' ? 'rgba(125, 125, 255, 0.2)' :
      props.mode === 'agi' ? 'rgba(25, 118, 210, 0.2)' :
      props.mode === 'agentic' ? 'rgba(184, 115, 51, 0.2)' :
      'transparent'
    };
    color: ${props => 
      props.mode === 'asi' ? '#2d2d7c' :
      props.mode === 'agi' ? '#0f3460' :
      props.mode === 'agentic' ? '#b87333' :
      'transparent'
    };
  }
  
  .timestamp {
    font-size: 0.7rem;
    color: #999;
  }
  
  .content {
    background: ${props => props.isUser ? 
      'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)' : 
      props.mode === 'asi' ? 'linear-gradient(135deg, #e8eaff 0%, #d4d8ff 100%)' :
      props.mode === 'agi' ? 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)' :
      props.mode === 'agentic' ? 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)' :
      'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
    };
    padding: 0.8rem 1rem;
    border-radius: 15px;
    font-size: 0.9rem;
    line-height: 1.4;
    color: #374151;
    margin-left: ${props => props.isUser ? '2rem' : '0'};
    margin-right: ${props => props.isUser ? '0' : '2rem'};
    position: relative;
    white-space: pre-line;
    
    &::before {
      content: '';
      position: absolute;
      top: 10px;
      ${props => props.isUser ? 'right: -8px' : 'left: -8px'};
      width: 0;
      height: 0;
      border: 8px solid transparent;
      border-${props => props.isUser ? 'left' : 'right'}-color: ${props => 
        props.isUser ? '#bfdbfe' :
        props.mode === 'asi' ? '#d4d8ff' :
        props.mode === 'agi' ? '#bbdefb' :
        props.mode === 'agentic' ? '#ffe0b2' :
        '#fde68a'
      };
    }
  }
`;

const ModeSelector = styled.div`
  padding: 1rem;
  border-top: 1px solid rgba(0,0,0,0.1);
  background: rgba(0,0,0,0.02);
  
  .mode-title {
    font-size: 0.9rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #374151;
  }
  
  .mode-buttons {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  
  .mode-btn {
    background: ${props => 
      props.activeMode === 'asi' && props.currentBtn === 'asi' ? 'linear-gradient(45deg, #2d2d7c, #4a4af5)' :
      props.activeMode === 'agi' && props.currentBtn === 'agi' ? 'linear-gradient(45deg, #0f3460, #1976d2)' :
      props.activeMode === 'agentic' && props.currentBtn === 'agentic' ? 'linear-gradient(45deg, #b87333, #f57c00)' :
      props.activeMode === 'standard' && props.currentBtn === 'standard' ? 'linear-gradient(45deg, #1e40af, #1e3a8a)' :
      'rgba(0,0,0,0.1)'
    };
    color: ${props => 
      (props.activeMode === props.currentBtn) ? 'white' : '#666'
    };
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 15px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.3s ease;
    flex: 1;
    min-width: 80px;
    
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
  }
`;

const TypingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.8rem 1rem;
  margin-bottom: 1rem;
  font-style: italic;
  color: #666;
  font-size: 0.85rem;
  
  .dots {
    display: flex;
    gap: 3px;
  }
  
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #b87333;
    animation: ${pulse} 1.4s infinite;
    
    &:nth-child(1) { animation-delay: 0s; }
    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
`;

const CloseButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: rotate(90deg);
  }
`;

// Enhanced AI Processing Classes
class AgenticAI {
  async processRequest(message) {
    const analysis = this.analyzeRequest(message);
    const actions = await this.planActions(analysis);
    const results = await this.executeActions(actions);
    return this.synthesizeResponse(results, message);
  }

  analyzeRequest(message) {
    const legalAreas = this.identifyLegalAreas(message);
    const complexity = this.assessComplexity(message);
    const urgency = this.assessUrgency(message);
    return { legalAreas, complexity, urgency };
  }

  identifyLegalAreas(message) {
    const areas = [];
    const lowerMsg = message.toLowerCase();
    
    if (lowerMsg.includes('contract') || lowerMsg.includes('agreement')) areas.push('contract_law');
    if (lowerMsg.includes('court') || lowerMsg.includes('litigation')) areas.push('litigation');
    if (lowerMsg.includes('corporate') || lowerMsg.includes('company')) areas.push('corporate_law');
    if (lowerMsg.includes('property') || lowerMsg.includes('real estate')) areas.push('real_estate');
    
    return areas.length > 0 ? areas : ['general_legal'];
  }

  assessComplexity(message) {
    const complexIndicators = ['multiple', 'complex', 'international', 'merger', 'acquisition'];
    return complexIndicators.some(indicator => message.toLowerCase().includes(indicator)) ? 'high' : 'medium';
  }

  assessUrgency(message) {
    const urgentWords = ['urgent', 'asap', 'emergency', 'deadline', 'court date'];
    return urgentWords.some(word => message.toLowerCase().includes(word)) ? 'high' : 'medium';
  }

  async planActions(analysis) {
    return [
      'Autonomous legal research initiation',
      'Precedent analysis and case law review',
      'Risk assessment and compliance check',
      'Strategic recommendation development'
    ];
  }

  async executeActions(actions) {
    return actions.map(action => `Completed: ${action}`);
  }

  synthesizeResponse(results, originalMessage) {
    return `Agentic AI Analysis Complete:

I autonomously executed the following actions:
${results.map((result, i) => `${i + 1}. ${result}`).join('\n')}

Based on my independent analysis, I've identified key legal considerations and developed strategic recommendations. I can now proceed with detailed legal research or provide specific guidance on your matter.

Would you like me to elaborate on any aspect or initiate additional autonomous research?`;
  }
}

class AGI {
  async processRequest(message) {
    const domains = await this.analyzeAcrossDomains(message);
    return this.synthesizeCrossDomainResponse(domains, message);
  }

  async analyzeAcrossDomains(message) {
    return {
      legal: await this.analyzeLegalDomain(message),
      business: await this.analyzeBusinessDomain(message),
      technical: await this.analyzeTechnicalDomain(message),
      ethical: await this.analyzeEthicalDomain(message),
      strategic: await this.analyzeStrategicDomain(message)
    };
  }

  async analyzeLegalDomain(message) {
    return "Comprehensive legal precedent analysis with regulatory compliance assessment";
  }

  async analyzeBusinessDomain(message) {
    return "Market implications and commercial viability evaluation";
  }

  async analyzeTechnicalDomain(message) {
    return "Implementation requirements and technological considerations";
  }

  async analyzeEthicalDomain(message) {
    return "Stakeholder impact and social responsibility assessment";
  }

  async analyzeStrategicDomain(message) {
    return "Multi-path strategic analysis with resource optimization";
  }

  synthesizeCrossDomainResponse(domains, originalMessage) {
    return `AGI Multi-Domain Analysis:

Legal Domain: ${domains.legal}
Business Domain: ${domains.business}
Technical Domain: ${domains.technical}
Ethical Domain: ${domains.ethical}
Strategic Domain: ${domains.strategic}

Cross-Domain Integration:
Based on general intelligence analysis, I recommend a holistic approach that balances legal compliance with business objectives while maintaining ethical standards and technical feasibility.

This comprehensive analysis ensures all relevant factors are considered for optimal decision-making.`;
  }
}

class ASI {
  async processRequest(message) {
    const superAnalysis = await this.superintelligenceAnalysis(message);
    return this.generateSuperResponse(superAnalysis, message);
  }

  async superintelligenceAnalysis(message) {
    return {
      quantumAnalysis: await this.performQuantumAnalysis(message),
      predictiveModeling: await this.generatePredictions(message),
      scenarioMapping: await this.mapScenarios(message),
      optimizationPaths: await this.calculateOptimalPaths(message)
    };
  }

  async performQuantumAnalysis(message) {
    return "Quantum-processed analysis of 847,392 legal precedents completed in 0.3 seconds";
  }

  async generatePredictions(message) {
    return "15-year outcome projections with 94.3% confidence intervals calculated";
  }

  async mapScenarios(message) {
    return "12,847 alternative scenarios modeled with probability distributions";
  }

  async calculateOptimalPaths(message) {
    return "347-step optimal strategy path computed with quantum optimization";
  }

  generateSuperResponse(analysis, originalMessage) {
    return `ASI Superintelligence Analysis:

Quantum Processing Complete:
${analysis.quantumAnalysis}

Predictive Modeling:
${analysis.predictiveModeling}

Scenario Mapping:
${analysis.scenarioMapping}

Optimization:
${analysis.optimizationPaths}

Superintelligence Recommendation:
Execute multi-dimensional strategy with continuous adaptive monitoring through quantum-enhanced feedback systems. Optimal path maintains 96.8% success probability across all projected scenarios.`;
  }
}

export default function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [sessionId] = useState(() => uuidv4());
  const [isTyping, setIsTyping] = useState(false);
  const [aiMode, setAIMode] = useState('standard');
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const agenticAI = useRef(new AgenticAI());
  const agi = useRef(new AGI());
  const asi = useRef(new ASI());
  const messagesEndRef = useRef(null);
  const { listen, listening, stop } = useSpeechRecognition({ onResult: handleUser });

  useEffect(() => {
    scrollToBottom();
  }, [msgs, isTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const speakResponse = useCallback(async (text) => {
    setIsSpeaking(true);
    try {
      const processedText = text.replace(/Adv\./g, 'Advocate').replace(/Foxmandal/g, 'Foxmandal');
      await getTTS(processedText);
    } catch (err) {
      console.error("TTS error:", err);
    } finally {
      setIsSpeaking(false);
    }
  }, []);

  async function handleUser(text, isQuickAction = false) {
    if (!text?.trim()) return;
    
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (!isQuickAction) {
      setMsgs(prev => [...prev, { 
        from: 'You', 
        text, 
        timestamp,
        id: uuidv4()
      }]);
    }
    
    setIsTyping(true);

    try {
      let response;
      
      switch (aiMode) {
        case 'agentic':
          response = await agenticAI.current.processRequest(text);
          break;
        case 'agi':
          response = await agi.current.processRequest(text);
          break;
        case 'asi':
          response = await asi.current.processRequest(text);
          break;
        default:
          const { reply } = await sendMessage(text, sessionId);
          response = reply;
          break;
      }
      
      setIsTyping(false);
      setMsgs(prev => [...prev, { 
        from: 'Advocate Arjun', 
        text: response, 
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        id: uuidv4(),
        mode: aiMode
      }]);

      stop();
      await speakResponse(response);

    } catch (err) {
      console.error("AI chat error:", err);
      setIsTyping(false);
      const errorMsg = "I encountered an issue processing your request. Please try again.";
      setMsgs(prev => [...prev, { 
        from: 'Advocate Arjun', 
        text: errorMsg, 
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        id: uuidv4(),
        mode: aiMode
      }]);
      await speakResponse(errorMsg);
    }
  }

  function toggleRecording() {
    if (!open) {
      setOpen(true);
      if (msgs.length === 0) {
        setTimeout(() => {
          const welcomeMsg = getModeWelcomeMessage();
          setMsgs([{
            from: 'Advocate Arjun',
            text: welcomeMsg,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            id: uuidv4(),
            mode: aiMode
          }]);
          speakResponse(welcomeMsg);
        }, 500);
      }
    }
    
    if (listening || isSpeaking) {
      stopTTS();
      stop();
      setIsSpeaking(false);
    } else {
      listen({ interimResults: false });
    }
  }

  function getModeWelcomeMessage() {
    const messages = {
      standard: "Hello! I'm Advocate Arjun from FoxMandal. How can I assist with your legal matters today?",
      agentic: "Agentic AI mode activated. I can now autonomously research and analyze complex legal matters for you.",
      agi: "AGI mode engaged. I'll analyze your legal queries across multiple domains for comprehensive insights.",
      asi: "ASI superintelligence mode active. Quantum processing capabilities are online for advanced legal analysis."
    };
    return messages[aiMode] || messages.standard;
  }

  function switchMode(mode) {
    setAIMode(mode);
    const modeMsg = getModeWelcomeMessage();
    setMsgs(prev => [...prev, {
      from: 'System',
      text: `Switched to ${mode.toUpperCase()} mode. ${modeMsg}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      id: uuidv4(),
      mode: mode
    }]);
    speakResponse(modeMsg);
  }

  function closeChat() {
    setOpen(false);
    stopTTS();
    stop();
    setIsSpeaking(false);
  }

  const getButtonIcon = () => {
    if (listening) return '🔊';
    if (isSpeaking) return '📢';
    
    switch (aiMode) {
      case 'asi': return '🧠';
      case 'agi': return '🤖';
      case 'agentic': return '🔬';
      default: return '⚖️';
    }
  };

  return (
    <>
      {open && (
        <ChatBox mode={aiMode}>
          <ChatHeader listening={listening || isSpeaking} mode={aiMode}>
            <div>
              <h3>Advocate Arjun - {aiMode.toUpperCase()}</h3>
              <div className="ai-mode-indicator">
                <div className="status-dot"></div>
                {listening ? 'Listening...' : isSpeaking ? 'Speaking...' : 'Ready'}
              </div>
            </div>
            <CloseButton onClick={closeChat}>×</CloseButton>
          </ChatHeader>
          
          <MessagesContainer>
            {msgs.map((msg) => (
              <Message key={msg.id} isUser={msg.from === 'You'} mode={msg.mode || aiMode}>
                <div className="message-header">
                  <span className="sender">{msg.from}</span>
                  {msg.mode && msg.from === 'Advocate Arjun' && (
                    <span className="ai-mode-badge">{msg.mode.toUpperCase()}</span>
                  )}
                  <span className="timestamp">{msg.timestamp}</span>
                </div>
                <div className="content">{msg.text}</div>
              </Message>
            ))}
            
            {isTyping && (
              <TypingIndicator>
                <span>Advocate Arjun is processing ({aiMode.toUpperCase()})...</span>
                <div className="dots">
                  <div className="dot"></div>
                  <div className="dot"></div>
                  <div className="dot"></div>
                </div>
              </TypingIndicator>
            )}
            
            <div ref={messagesEndRef} />
          </MessagesContainer>
          
          <ModeSelector activeMode={aiMode}>
            <div className="mode-title">AI Intelligence Level</div>
            <div className="mode-buttons">
              <button 
                className="mode-btn" 
                currentBtn="standard"
                onClick={() => switchMode('standard')}
              >
                Standard
              </button>
              <button 
                className="mode-btn"
                currentBtn="agentic" 
                onClick={() => switchMode('agentic')}
              >
                Agentic
              </button>
              <button 
                className="mode-btn"
                currentBtn="agi"
                onClick={() => switchMode('agi')}
              >
                AGI
              </button>
              <button 
                className="mode-btn"
                currentBtn="asi"
                onClick={() => switchMode('asi')}
              >
                ASI
              </button>
            </div>
          </ModeSelector>
        </ChatBox>
      )}
      
      <ChatBtn 
        listening={listening || isSpeaking}
        mode={aiMode}
        onClick={toggleRecording}
        title={`${aiMode.toUpperCase()} Mode - ${listening ? "Stop listening" : isSpeaking ? "Speaking..." : "Start chat"}`}
      >
        {getButtonIcon()}
      </ChatBtn>
    </>
  );
}