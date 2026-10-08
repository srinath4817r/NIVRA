// frontend/src/components/MicButton.jsx — speak instead of typing (hidden where unsupported)
import React from 'react';
import { Mic, MicOff } from 'lucide-react';
import useSpeechInput from '../hooks/useSpeechInput';
import { useLanguage } from '../context/LanguageContext';

export default function MicButton({ onText, className = '' }) {
  const { lang } = useLanguage();
  const { supported, listening, error, start, stop } = useSpeechInput({ lang, onText });
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      className={`btn-icon ${listening ? '!bg-red-500/30 !text-white animate-pulse' : ''} ${className}`}
      aria-label={listening ? 'Stop listening' : 'Speak your question'}
      aria-pressed={listening}
      title={error || (listening ? 'Listening… tap to stop' : 'Speak your question')}
    >
      {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-amber-300" />}
    </button>
  );
}
