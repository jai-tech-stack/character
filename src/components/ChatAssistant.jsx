// ChatAssistant.jsx with Fixed TTS and Pronunciation
import React, { useState, useEffect, useRef, useCallback } from "react";
import styled, { keyframes } from "styled-components";
import { useSpeechRecognition } from "react-speech-kit";
import { sendMessage, getTTS, stopTTS } from "../api/chatApi";
import { v4 as uuidv4 } from "uuid";

// ... (keep all your existing styled components) ...

// Smart Legal Lead Capture Logic (keep existing)
class SmartLegalCapture {
  constructor() {
    this.triggers = {
      consultation: ['consultation', 'legal advice', 'lawyer', 'attorney', 'help me', 'need legal', 'schedule', 'appointment'],
      urgency: ['urgent', 'asap', 'emergency', 'court date', 'deadline', 'immediately', 'time sensitive'],
      specific_legal: ['contract', 'lawsuit', 'dispute', 'litigation', 'corporate', 'IP', 'employment', 'property', 'tax'],
      pricing: ['cost', 'fee', 'price', 'charges', 'how much', 'expensive', 'affordable']
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
      'corporate_law': ['company', 'business', 'corporate', 'merger', 'acquisition'],
      'litigation': ['court', 'lawsuit', 'dispute', 'sue', 'legal action'],
      'contracts': ['contract', 'agreement', 'terms', 'breach'],
      'employment_law': ['employee', 'workplace', 'termination', 'labor'],
      'intellectual_property': ['trademark', 'patent', 'copyright', 'intellectual property', 'brand'],
      'real_estate': ['property', 'real estate', 'land', 'lease', 'rent']
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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [leadData, setLeadData] = useState({ 
    name: '', 
    email: '', 
    phone: '',
    legalArea: 'corporate_law',
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

  // Enhanced TTS handling
  const speakResponse = useCallback(async (text) => {
    if (!text) return;
    
    setIsSpeaking(true);
    try {
      await getTTS(text);
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
      const analysis = smartCapture.current.analyzeMessage(text);
      
      const { reply, userProfile } = await sendMessage(text, sessionId);
      
      setIsTyping(false);
      setMsgs(prev => [...prev, { 
        from: 'Advocate Arjun', // Fixed name display
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

      // Stop listening before speaking
      stop();
      
      // Speak the response
      await speakResponse(reply);

    } catch (err) {
      console.error("Legal chat error:", err);
      setIsTyping(false);
      const errorMsg = "I'm experiencing connectivity issues with our legal system. Please try again in a moment.";
      setMsgs(prev => [...prev, { 
        from: 'Advocate Arjun', 
        text: errorMsg, 
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        id: uuidv4()
      }]);
      await speakResponse(errorMsg);
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
      const response = await fetch('https://character-chan.onrender.com/capture-lead', {
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
        const successMsg = 'Perfect! Our legal team will contact you within 24 hours to discuss your matter. Is there anything else about our services you\'d like to know?';
        setMsgs(prev => [...prev, {
          from: 'System',
          text: successMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          id: uuidv4()
        }]);
        await speakResponse(successMsg);
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
          const welcomeMsg = "Hello! I'm Advocate Arjun, your AI legal consultant from Fox Man-dal, one of India's premier law firms. I can help you understand our legal services, discuss your legal needs, or provide general information about Indian law. How can I assist you with your legal matters today?";
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
    } else {
      listen({ interimResults: false });
    }
  }

  function closeChat() {
    setOpen(false);
    stopTTS();
    stop();
    setIsSpeaking(false);
    
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
          <ChatHeader listening={listening || isSpeaking}>
            <div>
              <h3>Chat with Advocate Arjun</h3>
              <div className="status">
                <div className="status-dot"></div>
                {listening ? 'Listening...' : isSpeaking ? 'Speaking...' : 'Ready to help'}
              </div>
            </div>
            <CloseButton onClick={closeChat}>×</CloseButton>
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
                  <option value="corporate_law">Corporate Law</option>
                  <option value="litigation">Litigation</option>
                  <option value="contracts">Contract Law</option>
                  <option value="intellectual_property">Intellectual Property</option>
                  <option value="employment_law">Employment Law</option>
                  <option value="real_estate">Real Estate</option>
                  <option value="tax_law">Tax Law</option>
                  <option value="consultation_request">General Legal Advice</option>
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
        listening={listening || isSpeaking}
        onClick={toggleRecording}
        title={listening ? "Stop listening" : isSpeaking ? "Speaking..." : "Start legal consultation"}
      >
        {listening ? '🔊' : isSpeaking ? '📢' : '⚖️'}
      </ChatBtn>
    </>
  );
}