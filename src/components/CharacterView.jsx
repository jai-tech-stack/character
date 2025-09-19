import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import styled, { keyframes } from 'styled-components';
import { useSpeechRecognition } from 'react-speech-kit';
import useTTS from '../hooks/useTTS';

const fadeIn = keyframes`from { opacity:0 } to { opacity:1 }`;

const Tooltip = styled.div`
  position: absolute;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.6);
  color: white;
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  font-size: 0.9rem;
  animation: ${fadeIn} 0.5s ease;
`;

const ChatBubble = styled.div`
  position: absolute;
  bottom: 6rem;
  left: 1rem;
  background: #fff;
  padding: 1rem;
  border-radius: 12px;
  max-width: 300px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  border-left: 4px solid #e74c3c;
  
  p {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.4;
  }
  
  button {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: none;
    border: none;
    font-size: 1rem;
    cursor: pointer;
    color: #999;
    
    &:hover {
      color: #e74c3c;
    }
  }
`;

const ContactForm = styled.div`
  position: absolute;
  top: 10%;
  left: 50%;
  transform: translateX(-50%);
  background: #fff;
  padding: 2rem;
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.2);
  
  h3 {
    margin-top: 0;
    color: #333;
    text-align: center;
  }
  
  input, textarea {
    width: 100%;
    margin-bottom: 1rem;
    padding: 0.75rem;
    border: 2px solid #eee;
    border-radius: 6px;
    font-size: 0.9rem;
    box-sizing: border-box;
    
    &:focus {
      outline: none;
      border-color: #e74c3c;
    }
  }
  
  textarea {
    height: 80px;
    resize: vertical;
  }
  
  .buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
  }
  
  button {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    
    &.submit {
      background: #e74c3c;
      color: white;
      
      &:hover {
        background: #c0392b;
      }
    }
    
    &.cancel {
      background: #95a5a6;
      color: white;
      
      &:hover {
        background: #7f8c8d;
      }
    }
  }
`;

export default function CharacterView({ onMessage }) {
  const container = useRef();
  const [loading, setLoading] = useState(true);
  const [aiText, setAiText] = useState('');
  const [showContactForm, setShowContactForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const { speak } = useTTS();
  const { listen, listening, stop } = useSpeechRecognition({ onResult: handleVoiceCommand });

  // Enhanced hotspot prompts for better context
  const hotspotPrompts = {
    history: "Tell me about Origami Creative's history and background as a branding agency",
    services: "What services does Origami Creative offer for branding and creative work?",
    contact: "I want to get in touch with Origami Creative team"
  };

  async function handleVoiceCommand(text) {
    if (!text) return;
    setAiText("Thinking...");
    
    try {
      const res = await fetch("http://localhost:3001/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });
      
      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }
      
      const { reply } = await res.json();
      setAiText(reply);
      onMessage?.(reply);
      await speakAndListen(reply);

      // Enhanced contact detection
      if (reply.toLowerCase().includes('contact') || 
          reply.toLowerCase().includes('reach out') || 
          reply.toLowerCase().includes('get in touch')) {
        setTimeout(() => setShowContactForm(true), 1000);
      }
    } catch (err) {
      console.error("❌ Chat error:", err);
      const errorMsg = "I'm having trouble connecting right now. Please try again in a moment.";
      setAiText(errorMsg);
    }
  }

  const speakAndListen = async (text) => {
    stop();
    window.speechSynthesis.cancel();
    await speak(text);
    // Auto-listen for next input
    setTimeout(() => {
      listen({ interimResults: false });
    }, 500);
  };

  useEffect(() => {
    const el = container.current;
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setClearColor(0x000000, 0.1); // Subtle background
    el.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(65, el.clientWidth / el.clientHeight, 0.1, 500);
    camera.position.set(0, 0, 2);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Create a fallback plane if image doesn't load
    const geometry = new THREE.PlaneGeometry(2, 1.5);
    let material = new THREE.MeshBasicMaterial({ 
      color: 0x2c3e50,
      transparent: true,
      opacity: 0.8
    });

    // Try to load the texture
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      '/origami-screenshot.jpg',
      (texture) => {
        material = new THREE.MeshBasicMaterial({ map: texture });
        plane.material = material;
        setLoading(false);
        animate();
      },
      undefined,
      (error) => {
        console.log('Could not load texture, using fallback');
        setLoading(false);
        animate();
      }
    );

    const plane = new THREE.Mesh(geometry, material);
    scene.add(plane);

    // Enhanced hotspot positions and styling
    const hotspotCoords = {
      history: [0.6, 0.3, 0.01],
      services: [-0.6, 0.2, 0.01],
      contact: [0, -0.4, 0.01]
    };

    const hotspots = {};
    Object.entries(hotspotCoords).forEach(([key, pos]) => {
      // Create hotspot with glow effect
      const hotspotGeometry = new THREE.SphereGeometry(0.04, 32, 32);
      const hotspotMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xe74c3c,
        transparent: true,
        opacity: 0.8
      });
      
      const mesh = new THREE.Mesh(hotspotGeometry, hotspotMaterial);
      mesh.position.set(...pos);
      mesh.name = key;
      scene.add(mesh);
      hotspots[key] = mesh;

      // Add glow ring
      const ringGeometry = new THREE.RingGeometry(0.06, 0.08, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xe74c3c,
        transparent: true,
        opacity: 0.3
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.position.set(...pos);
      scene.add(ring);
      hotspots[key + '_ring'] = ring;
    });

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function onPointerDown(e) {
      if (e.target !== renderer.domElement) return;
      
      const { left, top, width, height } = el.getBoundingClientRect();
      mouse.x = ((e.clientX - left) / width) * 2 - 1;
      mouse.y = -((e.clientY - top) / height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(scene.children);
      const hit = hits.find(h => hotspotCoords[h.object.name]);
      
      if (hit) {
        const hotspotName = hit.object.name;
        const prompt = hotspotPrompts[hotspotName] || hotspotName;
        handleVoiceCommand(prompt);
        
        // Smooth camera transition
        controls.target.copy(hit.object.position);
        camera.position.z = 1.5;
        controls.update();
      }
    }
    
    window.addEventListener('pointerdown', onPointerDown);

    function animate() {
      const time = Date.now() * 0.003;
      
      // Animate hotspots
      Object.entries(hotspots).forEach(([key, obj]) => {
        if (key.includes('_ring')) {
          const scale = 1 + 0.1 * Math.sin(time * 2);
          obj.scale.setScalar(scale);
        } else {
          const scale = 1 + 0.15 * Math.sin(time * 1.5);
          obj.scale.setScalar(scale);
          
          // Color cycling
          const hue = (Math.sin(time) + 1) * 0.1; // Red tones
          obj.material.color.setHSL(hue, 0.8, 0.5);
        }
      });
      
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    const onResize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointerdown', onPointerDown);
      if (el.contains(renderer.domElement)) {
        el.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  const handleGreetAndListen = async () => {
    const greeting = "Hi, I'm Rakesh — the AI brand strategist of Origami Creative. I'm here to help you understand our branding services and how we can transform your business. What would you like to know about our agency?";
    setAiText(greeting);
    onMessage?.(greeting);
    await speakAndListen(greeting);
  };

  const handleFormSubmit = () => {
    if (!formData.name || !formData.email) {
      alert('Please fill in your name and email');
      return;
    }
    
    // Here you would typically send the form data to your backend
    console.log('Form submitted:', formData);
    
    setShowContactForm(false);
    setAiText("Thank you for your interest! Someone from Origami Creative will get back to you soon.");
    setFormData({ name: '', email: '', message: '' });
  };

  return (
    <div ref={container} style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <Tooltip>{loading ? 'Loading Origami Creative experience...' : 'Click hotspots or talk to Rakesh'}</Tooltip>

      <button
        onClick={() => {
          if (listening) {
            stop();
            setAiText('');
          } else {
            handleGreetAndListen();
          }
        }}
        style={{
          position: 'absolute', 
          bottom: '1rem', 
          left: '1rem',
          padding: '0.8rem 1.2rem', 
          borderRadius: '25px',
          backgroundColor: listening ? '#e74c3c' : '#2c3e50',
          color: '#fff', 
          border: 'none', 
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          cursor: 'pointer',
          fontSize: '0.9rem',
          fontWeight: '500',
          transition: 'all 0.3s ease'
        }}>
        {listening ? '🛑 Stop Listening' : '🤖 Talk to Rakesh'}
      </button>

      {aiText && (
        <ChatBubble>
          <p>{aiText}</p>
          <button onClick={() => setAiText('')}>✖</button>
        </ChatBubble>
      )}

      {showContactForm && (
        <ContactForm>
          <h3>Connect with Origami Creative</h3>
          <input 
            placeholder="Your name" 
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
          />
          <input 
            placeholder="Email address" 
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
          />
          <textarea 
            placeholder="Tell us about your branding needs..."
            value={formData.message}
            onChange={(e) => setFormData({...formData, message: e.target.value})}
          />
          <div className="buttons">
            <button className="submit" onClick={handleFormSubmit}>Send Message</button>
            <button className="cancel" onClick={() => setShowContactForm(false)}>Cancel</button>
          </div>
        </ContactForm>
      )}
    </div>
  );
}