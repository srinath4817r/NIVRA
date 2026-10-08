// frontend/src/components/AIChatAssistant.jsx  — NIVRA Platform
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../context/ChatContext';
import { useLanguage } from '../context/LanguageContext';
import { ROUTES, trackState } from '../routes';
import MicButton from './MicButton';
import {
  Send, ImagePlus, FileText, CheckCircle2, ExternalLink, Bot,
  BookmarkPlus, ChevronRight, ListChecks, X, RotateCcw, ScanEye, PhoneCall
} from 'lucide-react';

const INTENT_BADGES = {
  STUDENT_SCHOLARSHIP: { label: '🎓 Scholarship', cls: 'badge-purple' },
  STUDENT_LOAN:        { label: '🏦 Education Loan', cls: 'badge-blue' },
  DISASTER_ASSISTANCE: { label: '🚨 Disaster & Emergency', cls: 'badge-red' },
  EMERGENCY_LOCATOR:   { label: '🚑 Emergency Locator', cls: 'badge-red' },
  GOVT_SERVICE_GUIDE:  { label: '📄 Certificate Guide', cls: 'badge-green' },
  GOVT_SCHEME:         { label: '🇮🇳 Government Scheme', cls: 'badge-green' },
  GENERAL_GUIDANCE:    { label: '💡 AI Guidance', cls: 'badge-saffron' },
};

const PRESET_QUERIES = [
  { label: '🎓 Scholarships for engineering students', query: "I am an engineering student. What government scholarships can I apply for?" },
  { label: '📄 How to apply for income certificate?', query: "How to apply for an income certificate and what documents are required?" },
  { label: '🏥 Nearest hospital around me', query: "Show me nearest 24/7 hospitals and emergency ambulance contacts." },
  { label: '🚨 Disaster alerts in my area', query: "Are there any heavy rain or flood alerts in my location?" },
  { label: '🏦 Education loan process', query: "How can I get an education loan without collateral under Vidya Lakshmi portal?" },
];

// Minimal **bold** / *italic* renderer for AI text (no HTML injection)
function RichText({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i} className="text-white font-bold">{p.slice(2, -2)}</strong>;
    if (p.startsWith('*') && p.endsWith('*') && p.length > 2) return <em key={i} className="text-amber-200">{p.slice(1, -1)}</em>;
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}

function IntentBadge({ category }) {
  const badge = INTENT_BADGES[category] || INTENT_BADGES.GENERAL_GUIDANCE;
  return <span className={`badge ${badge.cls} !text-[9px]`}>{badge.label}</span>;
}

function AIMessageDetails({ msg, onTrack }) {
  const items = (msg.matchedItems || []).slice(0, 6);
  return (
    <div className="mt-3 space-y-3">
      {msg.urgentAction && (
        <a href="tel:112" className="btn-emergency !animate-none w-full justify-center !py-2.5 text-sm">
          <PhoneCall className="w-4 h-4" /> Call 112 now
        </a>
      )}

      {msg.imageAnalysis?.success && (
        <div className="glass-well p-3">
          <p className="text-[11px] font-extrabold text-cyan-200 flex items-center gap-1.5 uppercase tracking-wider mb-1">
            <ScanEye className="w-3.5 h-3.5" /> Photo analysis · {msg.imageAnalysis.confidence} confidence
          </p>
          <p className="text-xs text-white font-bold capitalize">
            {msg.imageAnalysis.hazardType.replace('_', ' ')} <span className="badge badge-red !text-[8px] ml-1">{msg.imageAnalysis.severity}</span>
          </p>
          <p className="text-xs text-white/70 mt-1">{msg.imageAnalysis.summary}</p>
        </div>
      )}
      {msg.imageAnalysis?.available === false && (
        <p className="text-[11px] text-white/50">Photo analysis isn't set up on this server, so I only read your text.</p>
      )}

      {msg.documentChecklist?.length > 0 && (
        <div className="glass-well p-3">
          <p className="text-[11px] font-extrabold text-amber-300 flex items-center gap-1.5 uppercase tracking-wider mb-2">
            <FileText className="w-3.5 h-3.5" /> Documents checklist
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-white/80">
            {msg.documentChecklist.map((d, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {msg.nextSteps?.length > 0 && (
        <div className="glass-well p-3">
          <p className="text-[11px] font-extrabold text-pink-300 flex items-center gap-1.5 uppercase tracking-wider mb-2">
            <ListChecks className="w-3.5 h-3.5" /> Next steps
          </p>
          <ol className="space-y-1.5 text-xs text-white/80">
            {msg.nextSteps.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 bg-white/10 border border-white/15">{i + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {items.map((item, i) => (
            <div key={item.id || i} className="glass-card p-3 text-xs">
              <h4 className="font-bold text-white leading-snug">{item.name || item.schemeName}</h4>
              <p className="text-[11px] text-white/65 mt-1 line-clamp-2">
                {item.description || item.benefit || item.amount || item.maxLoanAmount || item.address || item.location}
              </p>
              <button
                onClick={() => onTrack(item)}
                className="mt-2 text-[11px] font-bold text-amber-300 hover:text-white flex items-center gap-1"
              >
                <BookmarkPlus className="w-3 h-3" /> Track application
              </button>
            </div>
          ))}
        </div>
      )}

      {msg.officialSources?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {msg.officialSources.map(src => (
            <a key={src.url} href={src.url} target="_blank" rel="noreferrer" className="chip !text-[11px]">
              <ExternalLink className="w-3 h-3" /> {src.name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AIChatAssistant() {
  const { messages, loading, sendMessage, resetChat } = useChat();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [inputText, setInputText] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const el = streamRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = (text = inputText) => {
    if (loading || (!text.trim() && !imageFile)) return;
    sendMessage(text, imageFile, imagePreview);
    setInputText('');
    setImageFile(null);
    setImagePreview(null);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
    e.target.value = '';
  };

  const handleTrack = (item) => navigate(ROUTES.profile, { state: trackState(item) });

  const hasConversation = messages.length > 1;

  return (
    <div className="max-w-4xl mx-auto space-y-4 fade-in">

      {/* Assistant header */}
      <section className="glass-panel p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full p-[2px] flex-shrink-0" style={{ background: 'var(--accent-grad)', boxShadow: '0 10px 30px -8px rgba(255,95,162,0.7)' }}>
            <div className="w-full h-full rounded-full bg-[#17132a]/90 flex items-center justify-center text-amber-200">
              <Bot className="w-7 h-7" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-2xl font-black text-white leading-tight">NIVRA AI</h2>
            <p className="text-xs text-white/60">{t.ai_subtitle}</p>
          </div>
          {hasConversation && (
            <button onClick={resetChat} className="btn-secondary !py-1.5 !px-3 text-xs" title="New conversation">
              <RotateCcw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t.new_chat}</span>
            </button>
          )}
        </div>

        {!hasConversation && (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2 stagger">
            {PRESET_QUERIES.map(pq => (
              <button
                key={pq.label}
                onClick={() => handleSend(pq.query)}
                className="glass-card p-3 text-xs font-semibold text-left text-white/90 flex items-center justify-between gap-2"
              >
                <span>{pq.label}</span>
                <ChevronRight className="w-4 h-4 text-amber-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Message stream */}
      <section
        ref={streamRef}
        className="glass-panel p-3 sm:p-4 flex flex-col gap-4 overflow-y-auto"
        style={{ minHeight: '360px', maxHeight: 'calc(100vh - 360px)' }}
        aria-live="polite"
      >
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col fade-in ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
            <div className="flex items-center gap-2 mb-1 px-1">
              {msg.sender === 'ai' ? (
                <>
                  <div className="n-logo-box !w-6 !h-6 !text-xs !rounded-lg">N</div>
                  <span className="text-xs font-bold text-white/80">NIVRA AI</span>
                  {!msg.welcome && !msg.error && <IntentBadge category={msg.intentCategory} />}
                  {msg.aiMode === 'basic' && (
                    <span className="badge badge-blue !text-[8px]" title="The AI model isn't available, so answers come from keyword matching">Basic mode</span>
                  )}
                </>
              ) : (
                <span className="text-xs font-bold text-white/60">You</span>
              )}
              <span className="text-[10px] text-white/35">{msg.timestamp}</span>
            </div>

            <div
              className={`max-w-[92%] sm:max-w-2xl p-3.5 sm:p-4 text-sm ${msg.sender === 'user' ? '' : 'glass-card !overflow-visible hover:!transform-none'}`}
              style={msg.sender === 'user'
                ? { background: 'var(--accent-grad)', color: '#fff', borderRadius: '20px 20px 6px 20px', boxShadow: '0 10px 26px -10px rgba(255,95,162,0.7), inset 0 1px 0 rgba(255,255,255,0.4)' }
                : { borderRadius: '6px 20px 20px 20px' }}
            >
              {msg.imagePreview && (
                <img src={msg.imagePreview} alt="Uploaded" className="rounded-xl mb-2 max-h-48 object-cover" />
              )}
              {msg.text && <div className="leading-relaxed whitespace-pre-line text-white/90"><RichText text={msg.text} /></div>}

              {msg.sender === 'ai' && !msg.welcome && !msg.error && <AIMessageDetails msg={msg} onTrack={handleTrack} />}
              {msg.sender === 'ai' && msg.disclaimer && (
                <p className="text-[10px] text-white/40 mt-3">{t.officialNotice}</p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 px-1 fade-in">
            <div className="n-logo-box !w-6 !h-6 !text-xs !rounded-lg">N</div>
            <div className="glass-card !rounded-full px-4 py-3 flex gap-1.5 hover:!transform-none">
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
            </div>
          </div>
        )}
      </section>

      {/* Composer */}
      <section className="glass-panel p-2.5 sticky bottom-28 z-20" style={{ borderRadius: 'var(--r-full)' }}>
        {imagePreview && (
          <div className="flex items-center gap-2 px-2 pb-2">
            <img src={imagePreview} alt="Attachment preview" className="w-10 h-10 rounded-lg object-cover" />
            <span className="text-xs text-white/70 truncate flex-1">{imageFile?.name}</span>
            <button onClick={() => { setImageFile(null); setImagePreview(null); }} className="btn-icon !p-1" aria-label="Remove image">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="flex items-center gap-2">
          <label className="btn-icon cursor-pointer flex-shrink-0" title="Attach a photo" aria-label="Attach a photo">
            <ImagePlus className="w-4 h-4 text-amber-300" />
            <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </label>

          <MicButton onText={(text) => setInputText(text)} className="flex-shrink-0" />
          <div className="search-glow-wrapper flex-1">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder={t.type_question}
              aria-label="Message"
              className="input-glass !py-2.5"
            />
          </div>

          <button
            type="submit"
            disabled={loading || (!inputText.trim() && !imageFile)}
            className="btn-primary !p-3 flex-shrink-0"
            aria-label="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </section>
    </div>
  );
}
