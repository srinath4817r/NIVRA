// frontend/src/context/ChatContext.jsx — AI conversation state that survives route changes
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { sendAIQuery, analyzePhoto } from '../services/api';
import { useLanguage } from './LanguageContext';

const ChatContext = createContext();

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const HISTORY_TURNS = 10;

const WELCOME = {
  sender: 'ai',
  welcome: true,
  text: "Namaste! 👋 I'm your **NIVRA AI Assistant**. Tell me your situation in simple words — for example: *'I am a college student needing help with fees'* or *'There is flooding in my street'*. I'll find matching schemes, the documents you need, and what to do next.",
  intentCategory: 'GENERAL_GUIDANCE',
  timestamp: now(),
};

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState([WELCOME]);
  const [loading, setLoading] = useState(false);
  const { lang } = useLanguage();
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const append = (msg) => setMessages(prev => [...prev, msg]);

  const sendMessage = useCallback(async (text, imageFile = null, imagePreview = null) => {
    let query = (text || '').trim();
    if (!query && !imageFile) return;

    // Prior turns (text only) so follow-ups like "what documents for that?" make sense
    const history = messagesRef.current
      .filter(m => !m.welcome && !m.error && m.text)
      .slice(-HISTORY_TURNS)
      .map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', text: m.text }));

    append({ sender: 'user', text: query, imagePreview, timestamp: now() });
    setLoading(true);

    try {
      let imageAnalysis = null;
      if (imageFile) {
        imageAnalysis = await analyzePhoto(imageFile, query).catch(() => null);
        if (imageAnalysis?.success) {
          query = `${query || 'I am sending a photo of a problem.'}\n\n[Photo analysis: ${imageAnalysis.hazardType}, severity ${imageAnalysis.severity}. ${imageAnalysis.summary}]`;
        } else if (!query) {
          query = 'I want to report a problem with a photo.';
        }
      }

      const res = await sendAIQuery(query, history, lang);
      append({
        sender: 'ai',
        text: res.responseText || 'Here is what I found.',
        intentCategory: res.intentCategory || 'GENERAL_GUIDANCE',
        aiMode: res.aiMode,
        matchedItems: res.matchedItems || [],
        documentChecklist: res.documentChecklist || [],
        nextSteps: res.nextSteps || [],
        officialSources: res.officialSources || [],
        urgentAction: res.urgentAction || false,
        disclaimer: res.disclaimer,
        imageAnalysis,
        timestamp: now(),
      });
    } catch (err) {
      append({
        sender: 'ai',
        error: true,
        text: `${err.message} If this is an emergency, call **112** now.`,
        intentCategory: 'GENERAL_GUIDANCE',
        timestamp: now(),
      });
    } finally {
      setLoading(false);
    }
  }, [lang]);

  const resetChat = useCallback(() => setMessages([{ ...WELCOME, timestamp: now() }]), []);

  return (
    <ChatContext.Provider value={{ messages, loading, sendMessage, resetChat }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
