// frontend/src/components/HomeScreen.jsx — NIVRA Home Dashboard
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useLanguage } from '../context/LanguageContext';
import { ROUTES } from '../routes';
import { trackers as trackersApi } from '../services/userApi';
import { daysUntil } from '../lib/ics';
import MicButton from './MicButton';
import {
  Search, ArrowUp, Building2, GraduationCap, Landmark, AlertTriangle,
  ShieldAlert, FileText, ChevronRight, Sparkles, ClipboardList, ListChecks, CalendarClock
} from 'lucide-react';

const CORE_SERVICES = [
  { to: ROUTES.services,     title: 'svc_schemes',  icon: Building2,     color: '#FF9933', bg: 'rgba(255,153,51,0.18)' },
  { to: ROUTES.scholarships, title: 'svc_student',     icon: GraduationCap, color: '#C29BFF', bg: 'rgba(169,112,255,0.2)' },
  { to: ROUTES.scholarships + '#loans', title: 'svc_loans', icon: Landmark, color: '#5FD4FF', bg: 'rgba(95,212,255,0.18)' },
  { to: ROUTES.emergency,    title: 'svc_emergency',  icon: AlertTriangle, color: '#FF4D63', bg: 'rgba(255,77,99,0.18)' },
  { to: ROUTES.emergency,    title: 'svc_disaster', icon: ShieldAlert,   color: '#34D399', bg: 'rgba(52,211,153,0.18)' },
  { to: ROUTES.documents,    title: 'svc_documents',           icon: FileText,      color: '#7DD3FC', bg: 'rgba(125,211,252,0.18)' },
];

const QUICK_ASKS = [
  'Scholarships for engineering students',
  'How to get an income certificate?',
  'Education loan without collateral',
  'Flood shelter near me',
];

function greetingKey() {
  const h = new Date().getHours();
  if (h < 12) return 'greet_morning';
  if (h < 17) return 'greet_afternoon';
  return 'greet_evening';
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { sendMessage } = useChat();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [inputText, setInputText] = useState('');
  const [upcoming, setUpcoming] = useState([]);

  // deadlines the user recorded on their trackers, next 14 days
  useEffect(() => {
    trackersApi.list()
      .then(list => setUpcoming(list
        .filter(t => t.deadline && daysUntil(t.deadline) >= 0 && daysUntil(t.deadline) <= 14)
        .sort((a, b) => a.deadline.localeCompare(b.deadline))))
      .catch(() => {});
  }, []);

  const firstName = user?.name ? user.name.split(' ')[0] : 'there';

  const ask = (text) => {
    if (!text.trim()) return;
    sendMessage(text);
    setInputText('');
    navigate(ROUTES.assistant);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto stagger">

      {/* Greeting Hero */}
      <section className="glass-panel p-5 sm:p-7 overflow-hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{t[greetingKey()]}</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-1">
              {firstName} <span className="inline-block origin-bottom-right hover:animate-pulse">👋</span>
            </h2>
            <p className="text-sm mt-1.5 text-white/65">{t.subtitle}</p>
          </div>

          <Link
            to={ROUTES.profile}
            className="w-14 h-14 rounded-[18px] p-[2px] flex-shrink-0 transition-transform hover:scale-105"
            style={{ background: 'var(--accent-grad)', boxShadow: '0 10px 28px -8px rgba(255,95,162,0.6)' }}
            title="Your profile"
            aria-label="Your profile"
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-full h-full rounded-[16px] object-cover"
                onError={e => {
                  e.target.onerror = null;
                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=FF5FA2&color=fff`;
                }}
              />
            ) : (
              <span className="w-full h-full rounded-[16px] bg-[#17132a] flex items-center justify-center text-white font-bold text-lg">
                {firstName[0]}
              </span>
            )}
          </Link>
        </div>

        {/* Ask NIVRA */}
        <form onSubmit={e => { e.preventDefault(); ask(inputText); }} className="mt-6">
          <div className="search-glow-wrapper">
            <Sparkles className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-white/50 z-10 pointer-events-none" />
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder={t.ask_placeholder}
              aria-label="Ask NIVRA"
              className="input-glass pl-12 pr-24 py-4 text-sm"
            />
            <MicButton onText={(text, final) => { setInputText(text); if (final) ask(text); }} className="absolute right-14 top-1/2 -translate-y-1/2 z-10 !p-2" />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="btn-primary !p-2.5 absolute right-1.5 top-1/2 -translate-y-1/2 z-10"
              aria-label="Send"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </form>

        <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
          {QUICK_ASKS.map(q => (
            <button key={q} onClick={() => ask(q)} className="chip">
              <Search className="w-3 h-3 opacity-60" /> {q}
            </button>
          ))}
        </div>
      </section>

      {upcoming.length > 0 && (
        <Link to={ROUTES.profile} className="glass-card p-4 flex items-center gap-3 !border-amber-300/30">
          <div className="service-icon-box !w-10 !h-10 !rounded-xl flex-shrink-0" style={{ background: 'rgba(255,181,71,0.2)', color: '#FFB547' }}>
            <CalendarClock className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">{t.deadlines_soon.replace('{n}', upcoming.length)}</p>
            <p className="text-xs text-white/65 truncate">
              {upcoming.map(t => `${t.title} (${daysUntil(t.deadline) === 0 ? 'today' : `${daysUntil(t.deadline)}d`})`).join(' · ')}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-white/50 flex-shrink-0" />
        </Link>
      )}

      {/* Core Services */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-base font-bold text-white">{t.core_services}</h3>
          <Link to={ROUTES.services} className="text-xs text-amber-300 font-semibold hover:text-white">{t.view_all}</Link>
        </div>

        <div className="grid-services-spec">
          {CORE_SERVICES.map(item => {
            const Icon = item.icon;
            return (
              <Link key={item.title} to={item.to} className="service-card-spec">
                <div className="service-icon-box" style={{ background: item.bg, color: item.color }}>
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-white leading-snug">{t[item.title]}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recommended */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-base font-bold text-white">{t.recommended}</h3>
        </div>

        <Link to={ROUTES.eligibility} className="glass-card p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="service-icon-box" style={{ background: 'rgba(52,211,153,0.2)', color: '#34D399' }}>
              <ListChecks className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-extrabold text-white text-base">{t.elig_card_title}</h4>
              <p className="text-xs text-white/60">{t.elig_card_sub}</p>
            </div>
          </div>
          <span className="btn-icon"><ChevronRight className="w-5 h-5" /></span>
        </Link>

        <Link to={ROUTES.scholarships} className="glass-card p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="service-icon-box" style={{ background: 'rgba(255,181,71,0.2)', color: '#FFB547' }}>
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-extrabold text-white text-base">{t.sch_card_title}</h4>
              <p className="text-xs text-white/60">{t.sch_card_sub}</p>
            </div>
          </div>
          <span className="btn-icon"><ChevronRight className="w-5 h-5" /></span>
        </Link>

        <Link to={ROUTES.profile} className="glass-card p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="service-icon-box" style={{ background: 'rgba(169,112,255,0.2)', color: '#C29BFF' }}>
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-extrabold text-white text-base">{t.track_card_title}</h4>
              <p className="text-xs text-white/60">{t.track_card_sub}</p>
            </div>
          </div>
          <span className="btn-icon"><ChevronRight className="w-5 h-5" /></span>
        </Link>
      </section>
    </div>
  );
}
