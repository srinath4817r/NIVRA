// frontend/src/context/LanguageContext.jsx — selected UI language (remembered on this device)
import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';
import { strings, LANGUAGES } from '../i18n/strings';

const LanguageContext = createContext();

export { LANGUAGES };

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem('nivra_lang');
      if (saved && strings[saved]) return saved;
    } catch { /* storage unavailable */ }
    // first visit: follow the browser if it's one of our languages
    const nav = (navigator.language || 'en').slice(0, 2);
    return strings[nav] ? nav : 'en';
  });

  // English fills any key a language hasn't translated yet
  const t = useMemo(() => ({ ...strings.en, ...(strings[lang] || {}) }), [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem('nivra_lang', lang); } catch { /* storage unavailable */ }
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
