// Real AI Chat Assistant - ChatAssistant.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import styled, { keyframes } from "styled-components";
import { useSpeechRecognition } from "react-speech-kit";
import { sendMessage, getTTS, stopTTS, captureLead } from "../api/chatApi";
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

const processingPulse = keyframes`
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
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
    props.processing ? 'linear-gradient(45deg, #fbbf24, #f59e0b)' :
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
    props.processing ? processingPulse :
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
    background: ${props => 
      props.processing ? '#fbbf24' :
      props.listening ? '#b87333' : 
      '#10b981'
    };
    animation: ${props => (props.listening || props.processing) ? pulse : 'none'} 1s infinite;
  }
  
  .processing-text {
    animation: ${processingPulse} 1.5s infinite;
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
    font-weight: 600;
  }
  
  .processing-type {
    font-size: 0.65rem;
    background: rgba(251, 191, 36, 0.2);
    color: #92400e;
    padding: 0.1rem 0.4rem;
    border-radius: 8px;
    font-weight: 600;
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
  
  .confidence-indicator {
    font-size: 0.7rem;
    color: #666;
    margin-top: 0.3rem;
    font-style: italic;
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
      props.activeMode === props.currentBtn ? 
        props.currentBtn === 'asi' ? 'linear-gradient(45deg, #2d2d7c, #4a4af5)' :
        props.currentBtn === 'agi' ? 'linear-gradient(45deg, #0f3460, #1976d2)' :
        props.currentBtn === 'agentic' ? 'linear-gradient(45deg, #b87333, #f57c00)' :
        'linear-gradient(45deg, #1e40af, #1e3a8a)' :
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
    
    &:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
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

const LeadCaptureForm = styled.div`
  background: rgba(248, 250, 252, 0.95);
  border-top: 1px solid rgba(0,0,0,0.1);
  padding: 1rem;
  
  .form-title {
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #374151;
  }
  
  .form-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  
  input, textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 0.9rem;
    
    &:focus {
      outline: none;
      border-color: #3b82f6;
    }
  }
  
  .submit-btn {
    background: linear-gradient(45deg, #1e40af, #1e3a8a);
    color: white;
    border: none;
    padding: 0.6rem 1.2rem;
    border-radius: 10px;
    cursor: pointer;
    font-size: 0.9rem;
    margin-top: 0.5rem;
    
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    
    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
`;

export default function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`);
  const [isTyping, setIsTyping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiMode, setAIMode] = useState('standard');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showLeadCapture, setShowLeadCapture] = useState(false);
  const [leadData, setLeadData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  
  const messagesEndRef = useRef(null);
  const { listen, listening, stop } = useSpeechRecognition({ 
    onResult: handleUser 
  });

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
      await getTTS(processedText, aiMode);
    } catch (err) {
      console.error("TTS error:", err);
    } finally {
      setIsSpeaking(false);
    }
  }, [aiMode]);

  // Real AI processing with genuine mode differences
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
    setIsProcessing(true);

    try {
      console.log(`Processing message with real ${aiMode} AI...`);
      
      // Use the real AI processor from chatApi
      const response = await sendMessage(text, sessionId, aiMode);
      
      setIsTyping(false);
      setIsProcessing(false);
      
      const aiMessage = {
        from: 'Advocate Arjun', 
        text: response.reply, 
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        id: uuidv4(),
        mode: aiMode,
        processingType: response.processingType,
        confidence: response.confidence
      };
      
      setMsgs(prev => [...prev, aiMessage]);

      // Check if this looks like a consultation request
      if (response.reply.toLowerCase().includes('consultation') || 
          text.toLowerCase().includes('lawyer') ||
          text.toLowerCase().includes('legal advice')) {
        setTimeout(() => setShowLeadCapture(true), 2000);
      }

      stop();
      await speakResponse(response.reply);

    } catch (err) {
      console.error(`Real ${aiMode} AI error:`, err);
      setIsTyping(false);
      setIsProcessing(false);
      const errorMsg = `I encountered an issue with ${aiMode} processing. Please try again.`;
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
        setTimeout(async () => {
          try {
            // Get real AI mode introduction
            const response = await sendMessage(
              `Introduce yourself as Advocate Arjun in ${aiMode} mode and explain your unique capabilities`,
              sessionId,
              aiMode
            );
            
            setMsgs([{
              from: 'Advocate Arjun',
              text: response.reply,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              id: uuidv4(),
              mode: aiMode,
              processingType: response.processingType
            }]);
            speakResponse(response.reply);
          } catch (error) {
            const fallbackMsg = getModeWelcomeMessage();
            setMsgs([{
              from: 'Advocate Arjun',
              text: fallbackMsg,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              id: uuidv4(),
              mode: aiMode
            }]);
            speakResponse(fallbackMsg);
          }
        }, 500);
      }
    }
    
    if (listening || isSpeaking) {
      stopTTS();
      stop();
      setIsSpeaking(false);
    } else if (!isProcessing) {
      listen({ interimResults: false });
    }
  }

  function getModeWelcomeMessage() {
    const messages = {
      standard: "Hello! I'm Advocate Arjun from FoxMandal. How can I assist with your legal matters today?",
      agentic: "Agentic AI mode activated. I can autonomously research and analyze complex legal matters step-by-step.",
      agi: "AGI mode engaged. I'll analyze your legal queries across multiple domains for comprehensive insights.",
      asi: "ASI mode active. Advanced probabilistic analysis and strategic projections are now available."
    };
    return messages[aiMode] || messages.standard;
  }

  async function switchMode(mode) {
    if (isProcessing) return; // Prevent mode switching during processing
    
    setAIMode(mode);
    
    try {
      // Get real AI explanation of the new mode
      const response = await sendMessage(
        `You are now switching to ${mode} mode. Explain how this changes your processing approach and capabilities as Advocate Arjun.`,
        sessionId,
        mode
      );
      
      setMsgs(prev => [...prev, {
        from: 'System',
        text: `Switched to ${mode.toUpperCase()} mode.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        id: uuidv4(),
        mode: mode
      }, {
        from: 'Advocate Arjun',
        text: response.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        id: uuidv4(),
        mode: mode,
        processingType: response.processingType
      }]);
      
      speakResponse(response.reply);
    } catch (error) {
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
  }

  async function handleLeadSubmit() {
    if (!leadData.name || !leadData.email) return;
    
    try {
      await captureLead(leadData, sessionId, aiMode);
      setShowLeadCapture(false);
      setLeadData({ name: '', email: '', phone: '', message: '' });
      
      const successMsg = "Thank you! Our legal team will contact you within 24 hours for a consultation.";
      setMsgs(prev => [...prev, {
        from: 'System',
        text: successMsg,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        id: uuidv4()
      }]);
      speakResponse(successMsg);
      
    } catch (error) {
      console.error('Lead capture error:', error);
    }
  }

  function closeChat() {
    setOpen(false);
    stopTTS();
    stop();
    setIsSpeaking(false);
    setIsProcessing(false);
    setShowLeadCapture(false);
  }

  const getButtonIcon = () => {
    if (isProcessing) return '⚙️';
    if (listening) return '🔊';
    if (isSpeaking) return '🔢';
    
    switch (aiMode) {
      case 'asi': return '🧠';
      case 'agi': return '🤖';
      case 'agentic': return '🔬';
      default: return '⚖️';
    }
  };

  const getStatusText = () => {
    if (isProcessing) return `Processing with ${aiMode.toUpperCase()}...`;
    if (listening) return 'Listening...';
    if (isSpeaking) return 'Speaking...';
    return 'Ready';
  };

  return (
    <>
      {open && (
        <ChatBox mode={aiMode}>
          <ChatHeader 
            listening={listening || isSpeaking} 
            processing={isProcessing}
            mode={aiMode}
          >
            <div>
              <h3>Advocate Arjun - {aiMode.toUpperCase()}</h3>
              <div className="ai-mode-indicator">
                <div className="status-dot"></div>
                <span className={isProcessing ? 'processing-text' : ''}>
                  {getStatusText()}
                </span>
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
                  {msg.processingType && (
                    <span className="processing-type">{msg.processingType}</span>
                  )}
                  <span className="timestamp">{msg.timestamp}</span>
                </div>
                <div className="content">
                  {msg.text}
                  {msg.confidence && (
                    <div className="confidence-indicator">
                      Confidence: {Math.round(msg.confidence * 100)}%
                    </div>
                  )}
                </div>
              </Message>
            ))}
            
            {isTyping && (
              <TypingIndicator>
                <span>Advocate Arjun is processing with {aiMode.toUpperCase()}...</span>
                <div className="dots">
                  <div className="dot"></div>
                  <div className="dot"></div>
                  <div className="dot"></div>
                </div>
              </TypingIndicator>
            )}
            
            <div ref={messagesEndRef} />
          </MessagesContainer>
          
          {showLeadCapture && (
            <LeadCaptureForm>
              <div className="form-title">Schedule Legal Consultation</div>
              <div className="form-row">
                <input
                  type="text"
                  placeholder="Your Name"
                  value={leadData.name}
                  onChange={(e) => setLeadData({...leadData, name: e.target.value})}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={leadData.email}
                  onChange={(e) => setLeadData({...leadData, email: e.target.value})}
                />
              </div>
              <input
                type="tel"
                placeholder="Phone Number"
                value={leadData.phone}
                onChange={(e) => setLeadData({...leadData, phone: e.target.value})}
              />
              <textarea
                placeholder="Brief description of your legal matter"
                value={leadData.message}
                onChange={(e) => setLeadData({...leadData, message: e.target.value})}
                rows="2"
              />
              <button 
                className="submit-btn"
                onClick={handleLeadSubmit}
                disabled={!leadData.name || !leadData.email}
              >
                Schedule Consultation
              </button>
            </LeadCaptureForm>
          )}
          
          <ModeSelector activeMode={aiMode}>
            <div className="mode-title">AI Intelligence Level</div>
            <div className="mode-buttons">
              <button 
                className="mode-btn" 
                currentBtn="standard"
                onClick={() => switchMode('standard')}
                disabled={isProcessing}
              >
                Standard
              </button>
              <button 
                className="mode-btn"
                currentBtn="agentic" 
                onClick={() => switchMode('agentic')}
                disabled={isProcessing}
              >
                Agentic
              </button>
              <button 
                className="mode-btn"
                currentBtn="agi"
                onClick={() => switchMode('agi')}
                disabled={isProcessing}
              >
                AGI
              </button>
              <button 
                className="mode-btn"
                currentBtn="asi"
                onClick={() => switchMode('asi')}
                disabled={isProcessing}
              >
                ASI
              </button>
            </div>
          </ModeSelector>
        </ChatBox>
      )}
      
      <ChatBtn 
        listening={listening || isSpeaking}
        processing={isProcessing}
        mode={aiMode}
        onClick={toggleRecording}
        title={`${aiMode.toUpperCase()} Mode - ${
          isProcessing ? "Processing..." :
          listening ? "Stop listening" : 
          isSpeaking ? "Speaking..." : 
          "Start chat"
        }`}
      >
        {getButtonIcon()}
      </ChatBtn>
    </>
  );
}