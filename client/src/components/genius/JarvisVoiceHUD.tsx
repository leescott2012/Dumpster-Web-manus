import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, MessageSquare, Send, Volume2, VolumeX, History, X, ChevronRight, Settings } from 'lucide-react';
import { useReactorAudio } from './useReactorAudio';
import GeniusHUD from './GeniusHUD';
import { sfx } from '../../lib/geniusAudio';
import { isMuted } from '../../utils/audioSynth';

interface JarvisVoiceHUDProps {
  onTranscript?: (transcript: string) => void;
  isOnline?: boolean;
}

type HUDState = 'idle' | 'listening' | 'thinking' | 'speaking';

export default function JarvisVoiceHUD({ onTranscript, isOnline = true }: JarvisVoiceHUDProps) {
  const [state, setState] = useState<HUDState>('idle');
  const [transcript, setTranscript] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [conversationMode, setConversationMode] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [history, setHistory] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  
  const reactor = useReactorAudio();
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const sessionIdRef = useRef<string>(() => {
    let id = sessionStorage.getItem('jarvis_session_id');
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem('jarvis_session_id', id);
    }
    return id;
  });

  // ── Speech Synthesis Logic ──────────────────────────────────────────────────
  
  const sanitizeText = (text: string) => {
    // Remove markdown links, URLs, and special characters for cleaner speech
    return text
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // [text](url) -> text
      .replace(/https?:\/\/\S+/g, '') // remove urls
      .replace(/[*_#`]/g, '') // remove markdown symbols
      .trim();
  };

  const speak = useCallback((text: string) => {
    if (isMuted()) {
      setState('idle');
      return;
    }

    const cleanText = sanitizeText(text);
    if (!cleanText) {
      setState('idle');
      return;
    }

    // Split into sentences to avoid cutoff
    const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];
    let currentSentence = 0;

    const speakNext = () => {
      if (currentSentence >= sentences.length) {
        setState('idle');
        if (conversationMode) startListening();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(sentences[currentSentence]);
      
      // Pick best English voice
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => v.name.includes('Daniel') || v.name.includes('Google UK English Male')) 
                     || voices.find(v => v.lang.startsWith('en-GB'))
                     || voices.find(v => v.lang.startsWith('en'));
      
      if (preferred) utterance.voice = preferred;
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      utterance.onstart = () => setState('speaking');
      utterance.onend = () => {
        currentSentence++;
        speakNext();
      };
      utterance.onerror = () => {
        setState('idle');
      };

      window.speechSynthesis.speak(utterance);
    };

    window.speechSynthesis.cancel();
    speakNext();
  }, [conversationMode]);

  // ── Web Speech API Logic ───────────────────────────────────────────────────

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser.");
      return;
    }

    if (state !== 'idle') return;

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setState('listening');
      reactor.start();
      sfx.playBeep(800, 0.05);
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const final = event.results[i][0].transcript;
          setTranscript(final);
          handleFinalTranscript(final);
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setLiveTranscript(interim);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      if (event.error === 'not-allowed') {
        alert("Microphone permission denied.");
      }
      setState('idle');
      reactor.stop();
    };

    recognition.onend = () => {
      if (state === 'listening') {
        setState('idle');
        reactor.stop();
      }
    };

    recognition.start();
  }, [state, reactor]);

  const handleFinalTranscript = async (text: string) => {
    if (!text.trim()) return;
    
    setState('thinking');
    setLiveTranscript('');
    setHistory(prev => [...prev, { role: 'user', content: text }]);
    
    try {
      // Send to n8n webhook or existing genius-chat endpoint
      const response = await fetch('/api/genius-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          transcript: text, 
          sessionId: sessionIdRef.current,
          context: 'jarvis_hud'
        }),
      });

      const data = await response.json();
      const reply = data.reply || "I encountered an error processing that request.";
      
      setHistory(prev => [...prev, { role: 'assistant', content: reply }]);
      speak(reply);
    } catch (error) {
      console.error('Error sending transcript:', error);
      setState('idle');
    }
  };

  const handleManualSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    const text = textInput;
    setTextInput('');
    handleFinalTranscript(text);
  };

  // ── Render Helpers ─────────────────────────────────────────────────────────

  const getStatusInfo = () => {
    switch (state) {
      case 'listening': return { label: 'LISTENING', color: '#D4AF37', pulse: true };
      case 'thinking': return { label: 'THINKING', color: '#FFFFFF', pulse: true };
      case 'speaking': return { label: 'SPEAKING', color: '#D4AF37', pulse: false };
      default: return { label: 'TAP TO SPEAK', color: '#D4AF37', pulse: false };
    }
  };

  const status = getStatusInfo();

  return (
    <div className="relative w-full h-full bg-black flex flex-col overflow-hidden font-mono border-r border-[#D4AF37]/10">
      
      {/* Header Info */}
      <div className="p-4 border-b border-[#D4AF37]/10 flex justify-between items-center bg-black/40 backdrop-blur-sm z-20">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-[10px] font-bold tracking-[0.4em] text-[#D4AF37]">JARVIS_v5.0</span>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setConversationMode(!conversationMode)}
            className={`p-1.5 rounded transition-colors ${conversationMode ? 'text-[#D4AF37] bg-[#D4AF37]/10' : 'text-gray-600 hover:text-gray-400'}`}
            title="Conversation Mode"
          >
            <History className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setShowTranscript(!showTranscript)}
            className={`p-1.5 rounded transition-colors ${showTranscript ? 'text-[#D4AF37] bg-[#D4AF37]/10' : 'text-gray-600 hover:text-gray-400'}`}
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main HUD Viewport */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        
        {/* Equalizer Ring (Simplified for SVG) */}
        <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
          <svg viewBox="0 0 100 100" className="w-[85%] h-[85%] rotate-[-90deg]">
            <circle
              cx="50" cy="50" r="48"
              fill="none"
              stroke="#D4AF37"
              strokeWidth="0.5"
              strokeDasharray="1 3"
            />
          </svg>
        </div>

        {/* The Genius HUD Component */}
        <div className="w-full h-full max-h-[500px]">
          <GeniusHUD 
            state={state} 
            isOnline={isOnline} 
            onTalk={startListening}
            levelRef={reactor.levelRef}
            bandsRef={reactor.bandsRef}
            peakRef={reactor.peakRef}
          />
        </div>

        {/* Live Transcript Overlay */}
        <AnimatePresence>
          {(liveTranscript || (state === 'listening' && !liveTranscript)) && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-12 left-0 right-0 px-8 text-center pointer-events-none z-30"
            >
              <div className="text-[#D4AF37] text-xs font-bold tracking-widest uppercase mb-2 opacity-50">
                {state === 'listening' ? 'Direct Input' : 'Processing...'}
              </div>
              <div className="text-white text-sm font-medium leading-relaxed max-w-xs mx-auto">
                {liveTranscript || "Awaiting voice command..."}
                <span className="inline-block w-1.5 h-4 bg-[#D4AF37] ml-1 animate-pulse align-middle" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Badge */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={state === 'idle' ? startListening : undefined}
            className={`px-6 py-2 rounded-full border border-[#D4AF37]/30 bg-black/80 flex items-center gap-3 transition-all ${state !== 'idle' ? 'cursor-default' : 'hover:border-[#D4AF37] hover:bg-[#D4AF37]/5'}`}
          >
            <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: status.color, boxShadow: status.pulse ? `0 0 10px ${status.color}` : 'none' }} />
            <span className="text-[10px] font-bold tracking-[0.3em]" style={{ color: status.color }}>
              {status.label}
            </span>
          </motion.button>
        </div>
      </div>

      {/* Collapsible Transcript Panel */}
      <AnimatePresence>
        {showTranscript && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: '40%' }}
            exit={{ height: 0 }}
            className="bg-[#050505] border-t border-[#D4AF37]/20 overflow-hidden flex flex-col z-40"
          >
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-[#D4AF37]/20">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-2">
                  <MessageSquare className="w-8 h-8 opacity-20" />
                  <span className="text-[10px] uppercase tracking-widest">No neural history</span>
                </div>
              ) : (
                history.map((msg, i) => (
                  <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className="text-[8px] uppercase tracking-widest text-gray-500 mb-1">
                      {msg.role === 'user' ? 'Neural Source' : 'Jarvis Core'}
                    </div>
                    <div className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-white' 
                        : 'bg-white/5 border border-white/10 text-gray-300'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Text Input Fallback */}
            <form onSubmit={handleManualSend} className="p-4 border-t border-[#D4AF37]/10 flex gap-2 bg-black">
              <input 
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Enter override command..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-xs text-white outline-none focus:border-[#D4AF37]/50 transition-colors"
              />
              <button 
                type="submit"
                disabled={!textInput.trim() || state !== 'idle'}
                className="p-2 bg-[#D4AF37] text-black rounded-lg disabled:opacity-50 transition-opacity"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Perimeter Markings */}
      <div className="absolute inset-0 pointer-events-none border border-[#D4AF37]/5 m-2" />
      <div className="absolute top-0 left-0 p-2 opacity-20">
        <div className="w-4 h-4 border-l border-t border-[#D4AF37]" />
      </div>
      <div className="absolute top-0 right-0 p-2 opacity-20">
        <div className="w-4 h-4 border-r border-t border-[#D4AF37]" />
      </div>
      <div className="absolute bottom-0 left-0 p-2 opacity-20">
        <div className="w-4 h-4 border-l border-b border-[#D4AF37]" />
      </div>
      <div className="absolute bottom-0 right-0 p-2 opacity-20">
        <div className="w-4 h-4 border-r border-b border-[#D4AF37]" />
      </div>
    </div>
  );
}
