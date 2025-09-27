// Enhanced Legal Chat Assistant for Fox Mandal
import React, { useState, useEffect, useRef, useCallback } from "react";
import styled, { keyframes } from "styled-components";
import { useSpeechRecognition } from "react-speech-kit";
import { sendMessage, getTTS } from "../api/chatApi";
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

const ChatBtn = styled.button`
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  background: ${props => props.listening ? 
    'linear-gradient(45deg, #b87333, #92400e)' : 
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
  animation: ${props => props.listening ? pulse : 'none'} 1.5s infinite;
  
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
  
  &::before {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    background: ${props => props.listening ? 
      'linear-gradient(45deg, #b87333, #92400e)' : 
      'linear-gradient(45deg, #1e40af, #1e3a8a)'
    };
    opacity: 0.3;
    z-index: -1;
    animation: ${props => props.listening ? pulse : 'none'} 2s infinite;
  }
`;

const ChatBox = styled.div`
  position: fixed;
  bottom: 10rem;
  right: 2rem;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(30px);
  padding: 0;
  width: 400px;
  max-width: calc(100vw - 4rem);
  max-height: 600px;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  border: 1px solid rgba(184, 115, 51, 0.2);
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
  
  .status {
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
    
    &::before {
      content: '';
      position: absolute;
      top: 10px;
      ${props => props.isUser ? 'right: -8px' : 'left: -8px'};
      width: 0;
      height: 0;
      border: 8px solid transparent;
      border-${props => props.isUser ? 'left' : 'right'}-color: ${props => props.isUser ? '#bfdbfe' : '#fde68a'};
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

const LeadCapturePrompt = styled.div`
  background: linear-gradient(135deg, #b87333 0%, #92400e 100%);
  color: white;
  padding: 1rem;
  margin: 0.5rem 0;
  border-radius: 15px;
  text-align: center;
  
  .lead-title {
    font-weight: 600;
    margin-bottom: 0.5rem;
  }
  
  .lead-subtitle {
    font-size: 0.85rem;
    opacity: 0.9;
    margin-bottom: 1rem;
  }
  
  .lead-buttons {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    flex-wrap: wrap;
  }
  
  .lead-btn {
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    cursor: pointer;
    font-size: 0.8rem;
    transition: all 0.3s ease;
    
    &:hover {
      background: rgba(255, 255, 255, 0.3);
    }
  }
`;

const QuickLeadForm = styled.div`
  padding: 1rem;
  background: rgba(0,0,0,0.02);
  border-top: 1px solid rgba(0,0,0,0.1);
  
  .form-title {
    font-weight: 600;
    margin-bottom: 1rem;
    color: #1e40af;
  }
  
  .form-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    flex-wrap: wrap;
  }
  
  input, select {
    flex: 1;
    padding: 0.6rem;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 0.85rem;
    min-width: 120px;
    
    &:focus {
      outline: none;
      border-color: #b87333;
      box-shadow: 0 0 0 2px rgba(184, 115, 51, 0.1);
    }
  }
  
  .submit-btn {
    background: linear-gradient(45deg, #b87333, #92400e);
    color: white;
    border: none;
    padding: 0.6rem 1.2rem;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.3s ease;
    width: 100%;
    margin-top: 0.5rem;
    
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(184, 115, 51, 0.3);
    }
    
    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
  
  .privacy-note {
    font-size: 0.7rem;
    color: #666;
    margin-top: 0.5rem;
    text-align: center;
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

// Smart Legal Lead Capture Logic
class SmartLegalCapture {
  constructor() {
    this.triggers = {
      consultation: ['consultation', 'legal advice', 'lawyer', 'attorney', 'help me', 'need legal'],
      urgency: ['urgent', 'asap', 'emergency', 'court date', 'deadline', 'immediately'],
      specific_legal: ['contract', 'lawsuit', 'dispute', 'litigation', 'corporate', 'IP', 'employment'],
      pricing: ['cost', 'fee', 'price', 'charges', 'how much', 'expensive']
    };
    
    this.leadScore = 0;
    this.triggerCount = 0;
    this.userProfile = {};
  }
  
  analyzeMessage(message) {
    const lowerMessage = message.toLowerCase();
    let shouldPromptCapture = false;
    let captureReason = '';
    
    Object.entries(this.triggers).forEach(([category, keywords]) => {
      const matches = keywords.filter(keyword => lowerMessage.includes(keyword));
      if (matches.length > 0) {
        this.leadScore += matches.length * 10;
        this.triggerCount++;
        
        if (category === 'consultation' || category === 'urgency') {
          shouldPromptCapture = true;
          captureReason = category;
        }
      }
    });
    
    // Extract legal area
    const legalAreas = {
      'corporate': ['company', 'business', 'corporate', 'merger'],
      'litigation': ['court', 'lawsuit', 'dispute', 'sue'],
      'contracts': ['contract', 'agreement', 'terms'],
      'employment': ['employee', 'workplace', 'termination'],
      'ip': ['trademark', 'patent', 'copyright', 'intellectual property']
    };
    
    Object.entries(legalAreas).forEach(([area, keywords]) => {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        this.userProfile.legalArea = area;
        this.leadScore += 15;
      }
    });
    
    if (this.triggerCount >= 2 && this.leadScore > 25) {
      shouldPromptCapture = true;
      captureReason = 'high_engagement';
    }
    
    return {
      shouldPromptCapture,
      captureReason,
      leadScore: this.leadScore,
      userProfile: this.userProfile
    };
  }
  
  getPromptMessage(reason) {
    const messages = {
      consultation: "I'd be happy to connect you with our legal team for a consultation. What's the best way to reach you?",
      urgency: "For urgent legal matters, let's get you connected with our attorneys immediately. Can you share your contact details?",
      high_engagement: "It sounds like you could benefit from professional legal guidance. Would you like to schedule a consultation with our team?"
    };
    
    return messages[reason] || messages.high_engagement;
  }
}

export default function LegalChatAssistant() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [sessionId] = useState(() => uuidv4());
  const [isTyping, setIsTyping] = useState(false);
  const [showLeadCapture, setShowLeadCapture] = useState(false);
  const [leadData, setLeadData] = useState({ 
    name: '', 
    email: '', 
    phone: '',
    legalArea: 'corporate',
    urgency: 'medium'
  });
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);
  
  const smartCapture = useRef(new SmartLegalCapture());
  const messagesEndRef = useRef(null);
  const { listen, listening, stop } = useSpeechRecognition({ onResult: handleUser });

  useEffect(() => {
    scrollToBottom();
  }, [msgs, isTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

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
      const analysis = smartCapture.current.analyzeMessage(text);
      
      const { reply, userProfile } = await sendMessage(text, sessionId);
      
      setIsTyping(false);
      setMsgs(prev => [...prev, { 
        from: 'Adv. Arjun', 
        text: reply, 
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        id: uuidv4(),
        leadCapture: analysis.shouldPromptCapture ? {
          reason: analysis.captureReason,
          message: smartCapture.current.getPromptMessage(analysis.captureReason)
        } : null
      }]);

      if (userProfile && Object.keys(userProfile).length > 0) {
        smartCapture.current.userProfile = { ...smartCapture.current.userProfile, ...userProfile };
      }

      stop();
      try {
        await getTTS(reply);
      } catch (err) {
        console.error("TTS error:", err);
      }

    } catch (err) {
      console.error("Legal chat error:", err);
      setIsTyping(false);
      setMsgs(prev => [...prev, { 
        from: 'Adv. Arjun', 
        text: "I'm experiencing connectivity issues. Please try again in a moment.", 
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        id: uuidv4()
      }]);
    }
  }

  const handleLeadCapture = (show) => {
    setShowLeadCapture(show);
    if (show && smartCapture.current.userProfile.legalArea) {
      setLeadData(prev => ({ 
        ...prev, 
        legalArea: smartCapture.current.userProfile.legalArea 
      }));
    }
  };

  const submitLead = async () => {
    if (!leadData.name || !leadData.email) {
      alert('Please fill in your name and email');
      return;
    }
    
    setIsSubmittingLead(true);
    
    try {
      const response = await fetch('/capture-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: leadData.name,
          email: leadData.email,
          phone: leadData.phone,
          legalArea: leadData.legalArea,
          urgency: leadData.urgency,
          sessionId: sessionId,
          leadScore: smartCapture.current.leadScore,
          userProfile: smartCapture.current.userProfile
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setShowLeadCapture(false);
        setMsgs(prev => [...prev, {
          from: 'System',
          text: 'Perfect! Our legal team will contact you within 24 hours to discuss your matter. Is there anything else about our services you\'d like to know?',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          id: uuidv4()
        }]);
      }
      
    } catch (error) {
      console.error('Lead submission error:', error);
      alert('Something went wrong. Please try again.');
    }
    
    setIsSubmittingLead(false);
  };

  function toggleRecording() {
    if (!open) {
      setOpen(true);
      if (msgs.length === 0) {
        setTimeout(() => {
          setMsgs([{
            from: 'Adv. Arjun',
            text: "Hello! I'm Adv. Arjun, your AI legal consultant from Fox Mandal. I can help you understand our legal services, discuss your legal needs, or provide general information about Indian law. How can I assist you today?",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            id: uuidv4()
          }]);
        }, 500);
      }
    }
    
    listening ? stop() : listen({ interimResults: false });
  }

  function closeChat() {
    setOpen(false);
    stop();
    
    console.log('Legal consultation session ended:', {
      sessionId,
      leadScore: smartCapture.current.leadScore,
      userProfile: smartCapture.current.userProfile,
      messageCount: msgs.length
    });
  }

  return (
    <>
      {open && (
        <ChatBox>
          <ChatHeader listening={listening}>
            <div>
              <h3>Chat with Adv. Arjun</h3>
              <div className="status">
                <div className="status-dot"></div>
                {listening ? 'Listening...' : 'Ready to help'}
              </div>
            </div>
            <CloseButton onClick={closeChat}>✕</CloseButton>
          </ChatHeader>
          
          <MessagesContainer>
            {msgs.map((msg) => (
              <div key={msg.id}>
                <Message isUser={msg.from === 'You'}>
                  <div className="message-header">
                    <span className="sender">{msg.from}</span>
                    <span className="timestamp">{msg.timestamp}</span>
                  </div>
                  <div className="content">{msg.text}</div>
                </Message>
                
                {msg.leadCapture && !showLeadCapture && (
                  <LeadCapturePrompt>
                    <div className="lead-title">Legal Consultation Available</div>
                    <div className="lead-subtitle">{msg.leadCapture.message}</div>
                    <div className="lead-buttons">
                      <button 
                        className="lead-btn"
                        onClick={() => handleLeadCapture(true)}
                      >
                        Yes, schedule consultation
                      </button>
                      <button 
                        className="lead-btn"
                        onClick={() => handleUser("Tell me more about your services first")}
                      >
                        More information first
                      </button>
                    </div>
                  </LeadCapturePrompt>
                )}
              </div>
            ))}
            
            {isTyping && (
              <TypingIndicator>
                <span>Adv. Arjun is analyzing...</span>
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
            <QuickLeadForm>
              <div className="form-title">Schedule Your Legal Consultation</div>
              <div className="form-row">
                <input
                  placeholder="Your name"
                  value={leadData.name}
                  onChange={(e) => setLeadData({...leadData, name: e.target.value})}
                />
                <input
                  placeholder="Email address"
                  type="email"
                  value={leadData.email}
                  onChange={(e) => setLeadData({...leadData, email: e.target.value})}
                />
              </div>
              <div className="form-row">
                <input
                  placeholder="Phone number"
                  type="tel"
                  value={leadData.phone}
                  onChange={(e) => setLeadData({...leadData, phone: e.target.value})}
                />
                <select
                  value={leadData.legalArea}
                  onChange={(e) => setLeadData({...leadData, legalArea: e.target.value})}
                >
                  <option value="corporate">Corporate Law</option>
                  <option value="litigation">Litigation</option>
                  <option value="contracts">Contract Law</option>
                  <option value="ip">Intellectual Property</option>
                  <option value="employment">Employment Law</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-row">
                <select
                  value={leadData.urgency}
                  onChange={(e) => setLeadData({...leadData, urgency: e.target.value})}
                >
                  <option value="low">General inquiry</option>
                  <option value="medium">Within a week</option>
                  <option value="high">Urgent matter</option>
                </select>
              </div>
              <button 
                className="submit-btn"
                onClick={submitLead}
                disabled={isSubmittingLead}
              >
                {isSubmittingLead ? 'Scheduling...' : 'Schedule Consultation'}
              </button>
              <div className="privacy-note">
                Your information is confidential and protected by attorney-client privilege principles.
              </div>
            </QuickLeadForm>
          )}
        </ChatBox>
      )}
      
      <ChatBtn 
        listening={listening}
        onClick={toggleRecording}
        title={listening ? "Stop listening" : "Start legal consultation"}
      >
        {listening ? '🔊' : '⚖️'}
      </ChatBtn>
    </>
  );
}