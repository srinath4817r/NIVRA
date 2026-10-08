// frontend/src/hooks/useSpeechInput.js — dictation via the browser's Web Speech API
// Supported in Chrome/Edge/Safari (incl. Android Chrome); `supported` is false elsewhere (e.g. Firefox).
import { useEffect, useRef, useState, useCallback } from 'react';

const LOCALES = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN', ta: 'ta-IN', mr: 'mr-IN', bn: 'bn-IN' };

const Recognition = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : undefined;

export default function useSpeechInput({ lang = 'en', onText }) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const rec = useRef(null);
  const onTextRef = useRef(onText);
  useEffect(() => { onTextRef.current = onText; }, [onText]);

  useEffect(() => () => rec.current?.abort(), []);

  const start = useCallback(() => {
    if (!Recognition) return;
    setError('');
    const r = new Recognition();
    r.lang = LOCALES[lang] || 'en-IN';
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      const text = Array.from(e.results).map(res => res[0].transcript).join(' ');
      onTextRef.current?.(text, e.results[e.results.length - 1].isFinal);
    };
    r.onerror = (e) => {
      setError(e.error === 'not-allowed' ? 'Microphone permission was denied.' : e.error === 'no-speech' ? "Didn't catch that. Try again." : 'Voice input stopped.');
    };
    r.onend = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  }, [lang]);

  const stop = useCallback(() => rec.current?.stop(), []);

  return { supported: !!Recognition, listening, error, start, stop };
}
