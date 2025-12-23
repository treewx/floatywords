import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import './App.css';

function FloatingWord({ text, position, fadeSpeed, onRemove }) {
  const [opacity, setOpacity] = useState(1);

  useFrame((state, delta) => {
    // Decrease opacity
    const newOpacity = opacity - (delta * fadeSpeed * 0.5); // Adjust multiplier as needed
    setOpacity(newOpacity);

    if (newOpacity <= 0) {
      onRemove();
    }
  });

  return (
    <Text
      position={position}
      fontSize={0.5}
      color="white"
      anchorX="center"
      anchorY="middle"
      fillOpacity={opacity}
      outlineOpacity={opacity} // Fade outline if present (default is none but good to have)
    >
      {text}
    </Text>
  );
}

function WordScene({ words, setWords, fadeSpeed }) {
  const removeWord = (id) => {
    setWords((prev) => prev.filter((w) => w.id !== id));
  };

  const meshRef = useRef();
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.5;
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <>
      <ambientLight intensity={0.8} />
      <pointLight position={[10, 10, 10]} intensity={1.5} />
      <mesh ref={meshRef} position={[0, 0, -2]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#8a2be2" wireframe opacity={0.3} transparent />
      </mesh>
      {words.map((word) => (
        <FloatingWord
          key={word.id}
          text={word.text}
          position={word.position}
          fadeSpeed={fadeSpeed}
          onRemove={() => removeWord(word.id)}
        />
      ))}
    </>
  );
}

function App() {
  const [text, setText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [speechRate, setSpeechRate] = useState(1);
  const [fadeSpeed, setFadeSpeed] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [cameraDistance, setCameraDistance] = useState(8);

  const synth = useRef(window.speechSynthesis);
  const utteranceRef = useRef(null);

  useEffect(() => {
    // Handle Web Share Target and URL parameters
    const params = new URLSearchParams(window.location.search);
    const sharedText = params.get('text');
    const sharedUrl = params.get('url');
    const sharedTitle = params.get('title');

    if (sharedText || sharedUrl) {
      const combinedText = [sharedTitle, sharedText, sharedUrl].filter(Boolean).join('\n');

      // If the shared text looks like a URL, try to fetch it
      const urlRegex = /https?:\/\/[^\s]+/;
      const match = combinedText.match(urlRegex);

      if (match) {
        handleGrabUrl(match[0]);
      } else {
        setText(combinedText);
      }

      // Clear URL params to avoid re-grabbing on refresh
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleGrabUrl = async (urlToGrab) => {
    const targetUrl = urlToGrab || urlInput;
    if (!targetUrl) return;

    let cleanUrl = targetUrl.trim();
    if (!cleanUrl.startsWith('http')) cleanUrl = 'https://' + cleanUrl;

    setLoading(true);

    // Try primary proxy (corsproxy.io)
    try {
      const response = await fetch(`https://corsproxy.io/?${encodeURIComponent(cleanUrl)}`);
      if (response.ok) {
        const html = await response.text();
        if (extractFromHtml(html)) {
          setLoading(false);
          setUrlInput('');
          return;
        }
      }
    } catch (e) {
      console.warn('Primary proxy failed, trying fallback...', e);
    }

    // Try fallback proxy (allorigins)
    try {
      const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(cleanUrl)}&timestamp=${Date.now()}`);
      if (!response.ok) throw new Error(`Proxy returned status ${response.status}`);
      const data = await response.json();
      if (data && data.contents) {
        if (extractFromHtml(data.contents)) {
          setLoading(false);
          setUrlInput('');
          return;
        }
      }
    } catch (error) {
      console.error('All proxies failed:', error);
      alert('Could not grab content. The website might be blocking access or the content is too large.');
    } finally {
      setLoading(false);
      setUrlInput('');
    }
  };

  const extractFromHtml = (html) => {
    if (!html || html.length < 100) return false;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const selectorsToRemove = ['script', 'style', 'nav', 'footer', 'header', 'aside', '.ads', '#ads', '.menu', '.sidebar', '.mw-editsection', '#mw-navigation', '#toc', '.infobox'];
    selectorsToRemove.forEach(s => doc.querySelectorAll(s).forEach(el => el.remove()));

    const wikiContent = doc.querySelector('#mw-content-text');
    const article = doc.querySelector('article') || doc.querySelector('main') || wikiContent || doc.body;

    if (article) {
      const plainText = article.innerText.replace(/\s+/g, ' ').replace(/\n+/g, '\n').trim();
      if (plainText.length > 50) {
        setText(plainText);
        return true;
      }
    }
    return false;
  };

  useEffect(() => {
    return () => {
      if (synth.current.speaking) {
        synth.current.cancel();
      }
    };
  }, []);

  const handlePlay = () => {
    if (synth.current.speaking) {
      synth.current.cancel();
      setIsPlaying(false);
      return;
    }

    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = speechRate;
    utteranceRef.current = utterance;

    utterance.onstart = () => {
      setIsPlaying(true);
      // Fallback for mobile: If no boundary event fires in 1s, start manual timer
      const timer = setTimeout(() => {
        if (!boundaryFired.current) {
          console.log('Mobile fallback: Starting manual word timer');
          startManualSpawn();
        }
      }, 1000);
      fallbackTimer.current = timer;
    };
    utterance.onend = () => cleanupSpeech();
    utterance.onerror = () => cleanupSpeech();

    utterance.onboundary = (event) => {
      boundaryFired.current = true;
      if (event.name === 'word') {
        const charIndex = event.charIndex;
        const textAfter = text.slice(charIndex);
        const match = textAfter.match(/^(\S+)/);
        if (match) {
          const wordText = match[1].replace(/[.,!?;:]/g, '');
          spawnWord(wordText);
        }
      }
    };

    synth.current.speak(utterance);
  };

  const boundaryFired = useRef(false);
  const fallbackTimer = useRef(null);
  const manualInterval = useRef(null);

  const cleanupSpeech = () => {
    setIsPlaying(false);
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    if (manualInterval.current) clearInterval(manualInterval.current);
    boundaryFired.current = false;
  };

  const startManualSpawn = () => {
    const wordsList = text.split(/\s+/).filter(w => w.length > 0);
    let index = 0;

    // Estimate words per minute based on rate
    // Average speech is ~150 wpm at 1x
    const wordsPerSecond = (150 / 60) * speechRate;
    const intervalMs = 1000 / wordsPerSecond;

    manualInterval.current = setInterval(() => {
      if (index < wordsList.length) {
        spawnWord(wordsList[index].replace(/[.,!?;:]/g, ''));
        index++;
      } else {
        clearInterval(manualInterval.current);
      }
    }, intervalMs);
  };

  const spawnWord = (wordText) => {
    const id = Math.random().toString(36).substr(2, 9);
    // Position logic:
    // x: -2 to 2
    // y: -1 to 1
    // z: 0 to 2 (closer to camera which is usually at 5)
    // We want them "near the front"
    const x = (Math.random() - 0.5) * 4;
    const y = (Math.random() - 0.5) * 3;
    const z = (Math.random() * 2) + 1; // 1 to 3

    setWords((prev) => [
      ...prev,
      { id, text: wordText, position: [x, y, z] }
    ]);
  };

  const handleStop = () => {
    synth.current.cancel();
    setIsPlaying(false);
    setWords([]);
  };

  return (
    <div className="app-container">
      <div className="canvas-container">
        <Canvas shadowMap>
          <PerspectiveCamera makeDefault position={[0, 0, cameraDistance]} fov={75} />
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            makeDefault
            minDistance={2}
            maxDistance={20}
          />
          <WordScene words={words} setWords={setWords} fadeSpeed={fadeSpeed} />
        </Canvas>
      </div>

      <button
        className="toggle-ui-btn"
        onClick={() => setShowControls(!showControls)}
        title={showControls ? "Minimize Controls" : "Show Controls"}
      >
        {showControls ? '↙' : '↗'}
      </button>

      <div className={`ui-overlay ${showControls ? '' : 'minimized'}`}>
        <div className="input-group">
          <input
            type="text"
            className="url-input"
            placeholder="Paste URL to grab content..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGrabUrl()}
          />
          <button className="grab-btn" onClick={() => handleGrabUrl()} disabled={loading}>
            {loading ? '...' : 'Grab'}
          </button>
        </div>

        <textarea
          className="text-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your text here..."
        />

        <div className="controls">
          <button className="play-btn" onClick={handlePlay}>
            {isPlaying ? 'Stop' : 'Play'}
          </button>

          <button className="clear-btn" onClick={() => { setText(''); handleStop(); }}>
            Clear
          </button>

          <div className="slider-group">
            <label>Speed: {speechRate}x</label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={speechRate}
              onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
            />
          </div>

          <div className="slider-group">
            <label>Zoom: {cameraDistance}m</label>
            <input
              type="range"
              min="3"
              max="15"
              step="0.5"
              value={cameraDistance}
              onChange={(e) => setCameraDistance(parseFloat(e.target.value))}
            />
          </div>

          <div className="slider-group">
            <label>Fade</label>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={fadeSpeed}
              onChange={(e) => setFadeSpeed(parseFloat(e.target.value))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
