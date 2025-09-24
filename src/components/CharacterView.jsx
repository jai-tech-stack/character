import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';
import styled, { keyframes } from 'styled-components';
import { useSpeechRecognition } from 'react-speech-kit';
import { sendMessage, getTTS } from '../api/chatApi';
import { v4 as uuidv4 } from 'uuid';

const fadeIn = keyframes`from { opacity:0 } to { opacity:1 }`;
const pulse = keyframes`0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); }`;
const glow = keyframes`0%, 100% { box-shadow: 0 0 20px rgba(231, 76, 60, 0.3); } 50% { box-shadow: 0 0 30px rgba(231, 76, 60, 0.8); }`;

const Container = styled.div`
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  transition: background 0.8s ease;
  
  &.branding-mode { background: linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%); }
  &.strategy-mode { background: linear-gradient(135deg, #2c3e50 0%, #4a6741 100%); }
  &.creative-mode { background: linear-gradient(135deg, #8360c3 0%, #2ebf91 100%); }
  
  @media (max-width: 768px) {
    height: 100vh;
  }
`;

const Tooltip = styled.div`
  position: absolute;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.8);
  color: white;
  padding: 0.8rem 1.2rem;
  border-radius: 25px;
  font-size: 0.9rem;
  font-weight: 500;
  animation: ${fadeIn} 0.5s ease;
  backdrop-filter: blur(10px);
  z-index: 100;
  
  @media (max-width: 768px) {
    left: 1rem;
    right: 1rem;
    transform: none;
    text-align: center;
    font-size: 0.8rem;
  }
`;

const InteractionButton = styled.button`
  position: absolute;
  bottom: 2rem;
  left: 2rem;
  padding: 1rem 2rem;
  border-radius: 50px;
  background: ${props => props.listening ? 
    'linear-gradient(45deg, #e74c3c, #c0392b)' : 
    'rgba(255, 255, 255, 0.2)'
  };
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(20px);
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.3s ease;
  animation: ${props => props.listening ? pulse : 'none'} 1.5s infinite;
  z-index: 100;

  @media (max-width: 768px) {
    left: 50%;
    transform: translateX(-50%);
    bottom: 1rem;
    padding: 0.8rem 1.5rem;
    font-size: 0.9rem;
  }

  &:hover {
    background: ${props => props.listening ? '#c0392b' : 'rgba(255, 255, 255, 0.3)'};
    box-shadow: 0 8px 25px rgba(0,0,0,0.2);
  }
`;

const ChatBubble = styled.div`
  position: absolute;
  bottom: 8rem;
  left: 2rem;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  padding: 1.5rem;
  border-radius: 20px;
  max-width: 400px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  border: 1px solid rgba(255, 255, 255, 0.2);
  animation: ${fadeIn} 0.5s ease;
  z-index: 90;

  @media (max-width: 768px) {
    left: 1rem;
    right: 1rem;
    bottom: 6rem;
    max-width: none;
    padding: 1.2rem;
  }

  p { 
    margin: 0; 
    font-size: 1rem; 
    line-height: 1.5; 
    color: #2c3e50;
    
    @media (max-width: 768px) {
      font-size: 0.9rem;
    }
  }

  .close-btn {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    color: #95a5a6;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    
    &:hover { 
      color: #e74c3c; 
      background: rgba(231, 76, 60, 0.1);
    }
  }
`;

const ContactForm = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(30px);
  padding: 2.5rem;
  border-radius: 20px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
  z-index: 200;
  animation: ${fadeIn} 0.5s ease;

  @media (max-width: 768px) {
    padding: 2rem 1.5rem;
    width: 95%;
    max-height: 90vh;
    overflow-y: auto;
  }

  h3 { 
    margin: 0 0 2rem 0; 
    text-align: center; 
    color: #2c3e50;
    font-size: 1.5rem;
    font-weight: 700;
  }

  input, textarea {
    width: 100%; 
    margin-bottom: 1.5rem; 
    padding: 1rem; 
    border: 2px solid rgba(0,0,0,0.1);
    border-radius: 12px; 
    font-size: 1rem; 
    background: rgba(255, 255, 255, 0.8);
    transition: all 0.3s ease;
    box-sizing: border-box;
    
    &:focus { 
      outline: none; 
      border-color: #e74c3c;
      background: white;
      box-shadow: 0 0 0 3px rgba(231, 76, 60, 0.1);
    }
  }

  textarea { 
    height: 120px; 
    resize: vertical;
    font-family: inherit;
  }

  .buttons { 
    display: flex; 
    gap: 1rem; 
    justify-content: center;
    flex-wrap: wrap;
  }

  .btn {
    padding: 1rem 2rem; 
    border: none; 
    border-radius: 12px; 
    cursor: pointer; 
    font-size: 1rem;
    font-weight: 600;
    transition: all 0.3s ease;
    min-width: 120px;
    
    &.submit { 
      background: linear-gradient(45deg, #e74c3c, #c0392b);
      color: white; 
      box-shadow: 0 4px 15px rgba(231, 76, 60, 0.3);
      
      &:hover { 
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(231, 76, 60, 0.4);
      }
    }
    
    &.cancel { 
      background: rgba(149, 165, 166, 0.2);
      color: #7f8c8d;
      border: 2px solid rgba(149, 165, 166, 0.3);
      
      &:hover { 
        background: rgba(149, 165, 166, 0.3);
        transform: translateY(-2px);
      }
    }
  }
`;

const HotspotInfo = styled.div`
  position: absolute;
  bottom: 12rem;
  right: 2rem;
  background: rgba(0,0,0,0.8);
  color: white;
  padding: 1rem 1.5rem;
  border-radius: 15px;
  font-size: 0.9rem;
  max-width: 300px;
  backdrop-filter: blur(10px);
  animation: ${fadeIn} 0.5s ease;
  
  @media (max-width: 768px) {
    right: 1rem;
    left: 1rem;
    bottom: 10rem;
    max-width: none;
    text-align: center;
  }
`;

// Agentic AI System
class SimpleAgenticAI {
  constructor() {
    this.context = {
      sessionId: uuidv4(),
      interactions: 0,
      leadScore: 0,
      interests: new Set(),
      emotionalState: 'neutral',
      lastIntent: null
    };
  }

  async processInput(input) {
    console.log('🧠 Processing with Agentic AI:', input.substring(0, 50));
    
    const intent = this.classifyIntent(input);
    const emotion = this.analyzeEmotion(input);
    
    this.context.interactions++;
    this.context.lastIntent = intent;
    this.context.emotionalState = emotion;
    
    // Update lead scoring
    this.updateLeadScore(input, intent);
    
    return {
      intent,
      emotion,
      avatarInstructions: this.generateAvatarInstructions(emotion, intent),
      nextActions: this.planNextActions(input, intent)
    };
  }

  classifyIntent(input) {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('price') || lowerInput.includes('cost') || lowerInput.includes('budget')) {
      return 'pricing_inquiry';
    }
    if (lowerInput.includes('contact') || lowerInput.includes('email') || lowerInput.includes('call')) {
      return 'contact_request';
    }
    if (lowerInput.includes('portfolio') || lowerInput.includes('work') || lowerInput.includes('examples')) {
      return 'portfolio_request';
    }
    if (lowerInput.includes('service') || lowerInput.includes('help') || lowerInput.includes('do')) {
      return 'service_inquiry';
    }
    if (lowerInput.includes('process') || lowerInput.includes('how') || lowerInput.includes('approach')) {
      return 'process_inquiry';
    }
    
    return 'general_inquiry';
  }

  analyzeEmotion(input) {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('excited') || lowerInput.includes('amazing') || lowerInput.includes('love')) {
      return 'excited';
    }
    if (lowerInput.includes('concerned') || lowerInput.includes('worried') || lowerInput.includes('problem')) {
      return 'concerned';
    }
    if (lowerInput.includes('thank') || lowerInput.includes('appreciate') || lowerInput.includes('great')) {
      return 'happy';
    }
    if (lowerInput.includes('thinking') || lowerInput.includes('consider') || lowerInput.includes('maybe')) {
      return 'thinking';
    }
    
    return 'neutral';
  }

  updateLeadScore(input, intent) {
    const scoreMap = {
      'pricing_inquiry': 20,
      'contact_request': 25,
      'portfolio_request': 10,
      'service_inquiry': 8,
      'process_inquiry': 5
    };
    
    this.context.leadScore += scoreMap[intent] || 2;
    this.context.interests.add(intent);
    
    if (this.context.leadScore > 30) {
      console.log('🔥 High-value lead detected:', this.context);
    }
  }

  generateAvatarInstructions(emotion, intent) {
    return {
      expression: emotion,
      gesture: this.mapIntentToGesture(intent),
      mode: this.determineBackgroundMode(intent)
    };
  }

  mapIntentToGesture(intent) {
    const gestureMap = {
      'pricing_inquiry': 'consultative',
      'contact_request': 'welcoming',
      'portfolio_request': 'presentation',
      'service_inquiry': 'explanatory'
    };
    
    return gestureMap[intent] || 'neutral';
  }

  determineBackgroundMode(intent) {
    if (intent === 'portfolio_request') return 'creative-mode';
    if (intent === 'pricing_inquiry' || intent === 'contact_request') return 'branding-mode';
    if (intent === 'process_inquiry') return 'strategy-mode';
    return 'default';
  }

  planNextActions(input, intent) {
    const actions = [];
    
    if (intent === 'contact_request') {
      actions.push('show_contact_form');
    }
    if (intent === 'portfolio_request') {
      actions.push('highlight_portfolio_hotspot');
    }
    if (intent === 'pricing_inquiry') {
      actions.push('prepare_pricing_discussion');
    }
    
    return actions;
  }
}

export default function CharacterView() {
  const container = useRef();
  const viewerRef = useRef();
  const isDisposedRef = useRef(false);
  const agenticAI = useRef(new SimpleAgenticAI());
  
  const [loading, setLoading] = useState(true);
  const [aiText, setAiText] = useState('');
  const [showContactForm, setShowContactForm] = useState(false);
  const [currentMode, setCurrentMode] = useState('default');
  const [hotspotInfo, setHotspotInfo] = useState('');
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  
  const { listen, listening, stop } = useSpeechRecognition({ onResult: handleVoiceCommand });

  const hotspotPrompts = {
    history: "Tell me about Origami Creative's background and company history",
    services: "What comprehensive services does Origami Creative offer?",
    caseStudies: "Show me examples of your successful brand projects",
    contact: "I want to get in touch with the Origami Creative team",
    process: "Explain your brand development process and approach"
  };

  async function handleVoiceCommand(text) {
    if (!text?.trim()) return;
    
    setAiText("Processing your request...");
    setHotspotInfo("");

    try {
      // Process with Agentic AI
      const aiAnalysis = await agenticAI.current.processInput(text);
      
      // Get response from your backend
      const { reply } = await sendMessage(text);
      
      setAiText(reply);
      
      // Apply AI-driven enhancements
      setCurrentMode(aiAnalysis.avatarInstructions.mode);
      
      // Execute planned actions
      aiAnalysis.nextActions.forEach(action => {
        switch (action) {
          case 'show_contact_form':
            setTimeout(() => setShowContactForm(true), 2000);
            break;
          case 'highlight_portfolio_hotspot':
            setHotspotInfo("Portfolio examples available - explore the scene!");
            break;
          case 'prepare_pricing_discussion':
            setHotspotInfo("Let's discuss your project requirements...");
            break;
        }
      });
      
      // Text-to-speech
      await getTTS(reply);
      
    } catch (err) {
      console.error("Chat error:", err);
      setAiText("I'm experiencing connectivity issues. Please try again in a moment.");
    }
  }

  useEffect(() => {
    isDisposedRef.current = false;
    const el = container.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(65, el.clientWidth / el.clientHeight, 0.1, 500);
    camera.position.set(0, 0, 2);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const viewer = new GaussianSplats3D.Viewer({
      renderer, camera,
      useBuiltInControls: false,
      webXRMode: GaussianSplats3D.WebXRMode.None,
      renderMode: GaussianSplats3D.RenderMode.OnChange,
      sceneRevealMode: GaussianSplats3D.SceneRevealMode.Instant,
      logLevel: GaussianSplats3D.LogLevel.None,
      worker: null
    });
    viewerRef.current = viewer;

    let animationId;

    const loadScene = async () => {
      console.log('Loading Gaussian Splat scene...');
      try {
        await viewer.addSplatScene('/scene.ksplat');

        if (isDisposedRef.current) {
          console.log('Component unmounted during load');
          return;
        }

        if (!viewer.scene || viewer.scene.children.length === 0) {
          console.error("Scene not initialized or empty after loading.");
          return;
        }

        setLoading(false);
        setupHotspots(viewer, camera);
        animate();
      } catch (e) {
        if (e.name === 'AbortedPromiseError') {
          console.warn('Scene loading was aborted');
        } else {
          console.error('Scene load failed:', e);
        }
      }
    };

    const animate = () => {
      if (isDisposedRef.current) return;
      
      controls.update();
      viewer.update();
      viewer.render();
      animationId = requestAnimationFrame(animate);
    };

    const onResize = () => {
      if (isDisposedRef.current) return;
      
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    
    window.addEventListener('resize', onResize);
    loadScene();

    return () => {
      console.log('Starting cleanup...');
      isDisposedRef.current = true;
      
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      
      window.removeEventListener('resize', onResize);
      
      setTimeout(() => {
        try {
          if (viewer && !viewer.disposed) {
            viewer.dispose();
          }
          if (el && renderer.domElement && el.contains(renderer.domElement)) {
            el.removeChild(renderer.domElement);
          }
          if (renderer) {
            renderer.dispose();
          }
        } catch (error) {
          console.warn('Error during cleanup:', error);
        }
      }, 100);
    };
  }, []);

  const handleGreetAndListen = async () => {
    const greeting = "Hello! I'm Rakesh, your AI brand strategist from Origami Creative. I'm here to help you explore our services and discuss your branding needs. What would you like to know?";
    setAiText(greeting);
    await getTTS(greeting);
    listen({ interimResults: false });
  };

  const handleFormSubmit = () => {
    if (!formData.name?.trim() || !formData.email?.trim()) {
      alert("Please fill in your name and email address");
      return;
    }
    
    // Log lead capture
    console.log('Lead captured:', {
      ...formData,
      leadScore: agenticAI.current.context.leadScore,
      interests: Array.from(agenticAI.current.context.interests),
      sessionId: agenticAI.current.context.sessionId
    });
    
    setShowContactForm(false);
    setAiText("Thank you for your interest! Our team will reach out to you within 24 hours to discuss your project.");
    setFormData({ name: '', email: '', message: '' });
    setCurrentMode('default');
  };

  function setupHotspots(viewer, camera) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    // Enhanced hotspot coordinates
    const coords = {
      history: [1, 0, 0],
      services: [-1, 0.5, 0],
      caseStudies: [0.5, 1, -0.5],
      contact: [-0.5, -0.5, 0.5],
      process: [0, 1, 1]
    };

    Object.entries(coords).forEach(([key, [x, y, z]]) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.05),
        new THREE.MeshBasicMaterial({ 
          visible: false,
          transparent: true,
          opacity: 0.3
        })
      );
      mesh.name = key;
      mesh.position.set(x, y, z);
      viewer.scene.add(mesh);
    });

    const handlePointerDown = (e) => {
      if (isDisposedRef.current) return;
      
      const { left, top, width, height } = container.current.getBoundingClientRect();
      mouse.x = ((e.clientX - left) / width) * 2 - 1;
      mouse.y = -((e.clientY - top) / height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(viewer.scene.children);
      const hit = hits.find(h => coords[h.object.name]);
      
      if (hit) {
        const hotspotName = hit.object.name;
        setHotspotInfo(`Exploring: ${hotspotName.toUpperCase()}`);
        handleVoiceCommand(hotspotPrompts[hotspotName] || hotspotName);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }

  return (
    <Container ref={container} className={currentMode}>
      <Tooltip>
        {loading 
          ? 'Loading immersive brand experience...' 
          : 'Explore the scene and interact with Rakesh'
        }
      </Tooltip>

      <InteractionButton 
        listening={listening}
        onClick={() => listening ? stop() : handleGreetAndListen()}
      >
        {listening ? '🛑 Stop Listening' : '🤖 Talk to Rakesh'}
      </InteractionButton>

      {aiText && (
        <ChatBubble>
          <p>{aiText}</p>
          <button className="close-btn" onClick={() => setAiText('')}>✕</button>
        </ChatBubble>
      )}

      {hotspotInfo && (
        <HotspotInfo>
          {hotspotInfo}
        </HotspotInfo>
      )}

      {showContactForm && (
        <ContactForm>
          <h3>Connect with Origami Creative</h3>
          <input 
            placeholder="Your full name" 
            value={formData.name} 
            onChange={e => setFormData({...formData, name: e.target.value})}
          />
          <input 
            placeholder="Email address" 
            type="email" 
            value={formData.email} 
            onChange={e => setFormData({...formData, email: e.target.value})}
          />
          <textarea 
            placeholder="Tell us about your project or branding needs..." 
            value={formData.message} 
            onChange={e => setFormData({...formData, message: e.target.value})}
          />
          <div className="buttons">
            <button className="btn submit" onClick={handleFormSubmit}>
              Send Message
            </button>
            <button className="btn cancel" onClick={() => setShowContactForm(false)}>
              Cancel
            </button>
          </div>
        </ContactForm>
      )}
    </Container>
  );
}