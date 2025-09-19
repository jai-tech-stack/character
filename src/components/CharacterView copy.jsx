import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';
import styled, { keyframes } from 'styled-components';
import { useSpeechRecognition } from 'react-speech-kit';
import useTTS from '../hooks/useTTS';
import { intents } from '../intents';

const fadeIn = keyframes`from { opacity:0 } to { opacity:1 }`;
const Tooltip = styled.div`
  position: absolute; top: 1rem; left:50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.6); color: white;
  padding: 0.4rem 0.8rem; border-radius:4px;
  font-size: 0.9rem; animation: ${fadeIn} 0.5s ease;
`;

export default function CharacterView() {
  const container = useRef();
  const viewerRef = useRef();
  const isDisposedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [aiText, setAiText] = useState('');
  const [showContactForm, setShowContactForm] = useState(false);
  const { speak } = useTTS();
  const { listen, listening, stop } = useSpeechRecognition({ onResult: handleVoiceCommand });

  async function handleVoiceCommand(text) {
    if (!text) return;
    setAiText("Thinking...");
    try {
      const res = await fetch("http://localhost:3001/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });
      const { reply } = await res.json();
      setAiText(reply);
      speak(reply);
      if (reply.toLowerCase().includes('contact')) {
        setShowContactForm(true);
      }
    } catch (err) {
      console.error("❌ Chat error:", err);
      setAiText("Sorry, I couldn't process that.");
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
    let isAnimating = false;

const loadScene = async () => {
  console.log('➡️ Loading scene at /scene.ksplat');
  try {
    const scene = await viewer.addSplatScene('/scene.ksplat');

    if (isDisposedRef.current) {
      console.log('⚠️ Component unmounted during load');
      return;
    }

    if (!viewer.scene || viewer.scene.children.length === 0) {
      console.error("❌ Scene not initialized or empty after loading.");
      return;
    }

    setLoading(false);
    setupHotspots(viewer, camera);
    animate();
  } catch (e) {
    if (e.name === 'AbortedPromiseError') {
      console.warn('⚠️ Scene loading was aborted');
    } else {
      console.error('❌ Scene load failed:', e);
    }
  }
};

    const animate = () => {
      if (isDisposedRef.current) return;
      
      isAnimating = true;
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
      console.log('🧹 Starting cleanup...');
      isDisposedRef.current = true;
      isAnimating = false;
      
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      
      window.removeEventListener('resize', onResize);
      
      // Give any pending operations a chance to complete
      setTimeout(() => {
        console.log('🧹 Disposing viewer safely...');
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
          console.warn('⚠️ Error during cleanup:', error);
        }
      }, 100);
    };
  }, []);

  const handleGreetAndListen = async () => {
    const greeting = "Hi, I'm Rakesh — the AI brand strategist of Origami Creative. How can I assist you today?";
    setAiText(greeting);
    await speak(greeting);
    listen({ interimResults: false });
  };

  return (
    <div ref={container} style={{ position:'relative', width:'100%', height:'100vh' }}>
      <Tooltip>{loading ? 'Loading model...' : 'Drag to explore'}</Tooltip>
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
          position: 'absolute', bottom: '1rem', left: '1rem',
          padding: '0.6rem 1rem', borderRadius: '30px',
          backgroundColor: listening ? '#e74c3c' : '#333',
          color: '#fff', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}>
        {listening ? '🛑 Stop' : '🤖 Talk to Rakesh'}
      </button>

      {aiText && (
        <div style={{
          position: 'absolute', bottom: '6rem', left: '1rem',
          background: '#fff', padding: '1rem', borderRadius: '8px',
          maxWidth: '260px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          <p>{aiText}</p>
          <button onClick={() => setAiText('')}>✖</button>
        </div>
      )}

      {showContactForm && (
        <div style={{
          position: 'absolute', top:'10%', left:'50%', transform:'translateX(-50%)',
          background:'#fff', padding:'2rem', borderRadius:'8px',
          width:'90%', maxWidth:'400px', boxShadow:'0 4px 12px rgba(0,0,0,0.2)'
        }}>
          <h3>Reach Out to Rakesh</h3>
          <input placeholder="Your name" style={{ width:'100%', marginBottom:'1rem', padding:'.5rem' }} />
          <input placeholder="Email" style={{ width:'100%', marginBottom:'1rem', padding:'.5rem' }} />
          <textarea placeholder="Your message" style={{ width:'100%', marginBottom:'1rem', padding:'.5rem' }} />
          <button style={{ marginRight:'1rem' }}>Submit</button>
          <button onClick={() => setShowContactForm(false)}>Cancel</button>
        </div>
      )}
    </div>
  );

  function setupHotspots(viewer, camera) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
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
        new THREE.MeshBasicMaterial({ visible: false })
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
      if (hit) handleVoiceCommand(hit.object.name);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    
    // Return cleanup function for hotspots
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }
}