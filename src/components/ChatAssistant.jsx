// Simplified Chat Assistant - ChatAssistant.jsx
// Single "Smart AI" mode - no confusing options for clients

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

const ChatBtn = styled.button`
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  background: ${props => 
    props.listening ? 'linear-gradient(45deg, #b87333, #92400e)' :
    props.processing ? 'linear-gradient(45deg, #fbbf24, #f59e0b)' :
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
    props.listening || props.processing ? pulse : 'none'
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
  border: 1px solid rgba(30, 64, 175, 0.2);
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
  background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%);
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
  
  .status-info {
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
  
  .timestamp {
    font-size: 0.7rem;
    color: #999;
  }
  
  .content {
    background: ${props => props.isUser ? 
      'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)' : 
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
        props.isUser ? '#bfdbfe' : '#fde68a'
      };
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
    width: 100%;
    
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

const QuickActions = styled.div`
  padding: 1rem;
  border-top: 1px solid rgba(0,0,0,0.1);
  background: rgba(248, 250, 252, 0.5);
  
  .quick-title {
    font-size: 0.85rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #374151;
  }
  
  .quick-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  
  .quick-btn {
    background: white;
    border: 1px solid #d1d5db;
    color: #374151;
    padding: 0.4rem 0.8rem;
    border-radius: 12px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.3s ease;
    
    &:hover {
      background: #f3f4f6;
      border-color: #1e40af;
      color: #1e40af;
    }
  }
`;

export default function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [sessionId] = useState(() => `session_foxmandal_agentic_${Date.now()}_${Math.random().toString(36).substring(2, 15).toLowerCase()}`);
  const [isTyping, setIsTyping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
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
      const processedText = text.replace(/Adv\./g, 'Advocate');
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
    setIsProcessing(true);

    try {
      console.log('Processing with Smart AI...');
      
      const response = await sendMessage(text, sessionId, 'agentic');
      
      setIsTyping(false);
      setIsProcessing(false);
      
      const aiMessage = {
        from: 'Advocate Arjun', 
        text: response.reply, 
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        id: uuidv4()
      };
      
      setMsgs(prev => [...prev, aiMessage]);

      // Auto-trigger lead capture for consultation queries
      if (response.reply.toLowerCase().includes('consultation') || 
          text.toLowerCase().includes('lawyer') ||
          text.toLowerCase().includes('legal advice')) {
        setTimeout(() => setShowLeadCapture(true), 2000);
      }

      stop();
      await speakResponse(response.reply);

    } catch (err) {
      console.error('AI error:', err);
      setIsTyping(false);
      setIsProcessing(false);
      const errorMsg = `I encountered an issue processing your request. Please try again.`;
      setMsgs(prev => [...prev, { 
        from: 'Advocate Arjun', 
        text: errorMsg, 
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        id: uuidv4()
      }]);
      await speakResponse(errorMsg);
    }
  }

  function toggleRecording() {
    if (!open) {
      setOpen(true);
      if (msgs.length === 0) {
        setTimeout(async () => {
          const welcomeMsg = "Hello! I'm Advocate Arjun from FoxMandal. I can help you with any legal questions. How can I assist you today?";
          setMsgs([{
            from: 'Advocate Arjun',
            text: welcomeMsg,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            id: uuidv4()
          }]);
          speakResponse(welcomeMsg);
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

  async function handleQuickAction(action) {
    const quickQueries = {
      'contract': 'I need help reviewing a contract',
      'employment': 'I have questions about employment law',
      'property': 'I need legal advice about property matters',
      'consultation': 'I would like to schedule a legal consultation'
    };
    
    await handleUser(quickQueries[action], true);
  }

  async function handleLeadSubmit() {
    if (!leadData.name || !leadData.email) return;
    
    try {
      await captureLead(leadData, sessionId, 'agentic');
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
    if (listening) return '🎤';
    if (isSpeaking) return '🔊';
    return '⚖️';
  };

  const getStatusText = () => {
    if (isProcessing) return 'Processing...';
    if (listening) return 'Listening...';
    if (isSpeaking) return 'Speaking...';
    return 'Online';
  };

  return (
    <>
      {open && (
        <ChatBox>
          <ChatHeader 
            listening={listening || isSpeaking} 
            processing={isProcessing}
          >
            <div>
              <h3>Advocate Arjun - Legal AI</h3>
              <div className="status-info">
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
              <Message key={msg.id} isUser={msg.from === 'You'}>
                <div className="message-header">
                  <span className="sender">{msg.from}</span>
                  <span className="timestamp">{msg.timestamp}</span>
                </div>
                <div className="content">{msg.text}</div>
              </Message>
            ))}
            
            {isTyping && (
              <TypingIndicator>
                <span>Advocate Arjun is analyzing...</span>
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
              <div className="form-title">📅 Schedule Legal Consultation</div>
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
          
          <QuickActions>
            <div className="quick-title">Quick Actions</div>
            <div className="quick-buttons">
              <button className="quick-btn" onClick={() => handleQuickAction('contract')}>
                📄 Contract Review
              </button>
              <button className="quick-btn" onClick={() => handleQuickAction('employment')}>
                💼 Employment Law
              </button>
              <button className="quick-btn" onClick={() => handleQuickAction('property')}>
                🏠 Property Matters
              </button>
              <button className="quick-btn" onClick={() => handleQuickAction('consultation')}>
                📞 Book Consultation
              </button>
            </div>
          </QuickActions>
        </ChatBox>
      )}
      
      <ChatBtn 
        listening={listening || isSpeaking}
        processing={isProcessing}
        onClick={toggleRecording}
        title={
          isProcessing ? "Processing..." :
          listening ? "Stop listening" : 
          isSpeaking ? "Speaking..." : 
          "Start chat"
        }
      >
        {getButtonIcon()}
      </ChatBtn>
    </>
  );
}