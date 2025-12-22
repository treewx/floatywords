import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
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

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
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

    setLoading(true);
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}&timestamp=${Date.now()}`;
      const response = await fetch(proxyUrl);

      if (!response.ok) throw new Error(`Proxy returned status ${response.status}`);

      const data = await response.json();

      if (data && data.contents) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(data.contents, 'text/html');

        // Basic extraction: get main text content
        // Remove script, style, nav, footer, ads
        const selectorsToRemove = ['script', 'style', 'nav', 'footer', 'header', 'aside', '.ads', '#ads', '.menu'];
        selectorsToRemove.forEach(s => {
          doc.querySelectorAll(s).forEach(el => el.remove());
        });

        // Try to find the "article" or "main" content, otherwise use body
        const contentArea = doc.querySelector('article') || doc.querySelector('main') || doc.body;
        const plainText = contentArea.innerText
          .replace(/\s+/g, ' ')
          .replace(/\n+/g, '\n')
          .trim();

        setText(plainText);
      }
    } catch (error) {
      console.error('Failed to grab content:', error);
      alert('Could not grab content from this URL. It might be blocked or require a different proxy.');
    } finally {
      setLoading(false);
      setUrlInput('');
    }
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

    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        const charIndex = event.charIndex;
        // Simple word extraction
        const textAfter = text.slice(charIndex);
        const match = textAfter.match(/^(\S+)/);
        if (match) {
          const wordText = match[1].replace(/[.,!?;:]/g, ''); // Clean punctuation
          spawnWord(wordText);
        }
      }
    };

    synth.current.speak(utterance);
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
        <Canvas camera={{ position: [0, 0, 5] }}>
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
