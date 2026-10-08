// frontend/src/components/Header.jsx  — NIVRA Platform
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage, LANGUAGES } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../routes';
import { ShieldAlert, Globe, PhoneCall, X, User } from 'lucide-react';
import SosContacts from './SosContacts';
import ModalPortal from './ModalPortal';

const HELPLINES = [
  { number: '112',  label: 'hl_all',       color: '#FF4D63' },
  { number: '108',  label: 'hl_ambulance', color: '#34D399' },
  { number: '101',  label: 'hl_fire',      color: '#FFB547' },
  { number: '1070', label: 'hl_disaster',  color: '#5FD4FF' },
];

const avatarFallback = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=FF5FA2&color=fff`;

export default function Header() {
  const { lang, setLang, t } = useLanguage();
  const { user } = useAuth();
  const [showSOSModal, setShowSOSModal] = useState(false);

  return (
    <>
      <header className="glass-panel app-header mx-2 sm:mx-4 mt-2 px-3 sm:px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">

          {/* ── Logo & Brand ── */}
          <Link to={ROUTES.home} className="flex items-center gap-3 min-w-0">
            <img
              src="/nivra_logo.png"
              alt="NIVRA Logo"
              className="w-10 h-10 rounded-[14px] object-cover shadow-lg flex-shrink-0"
              style={{ border: '1px solid rgba(255,255,255,0.3)' }}
            />
            <div className="min-w-0">
              <h1 className="font-display font-black text-lg tracking-tight text-white leading-none">
                NIVRA
              </h1>
              <div
                className="text-[9px] font-black uppercase mt-1"
                style={{
                  background: 'linear-gradient(90deg, #FF9933 0%, #FFFFFF 50%, #34D399 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  letterSpacing: '1.5px',
                }}
              >
                India Edition
              </div>
            </div>
          </Link>

          <p className="hidden lg:block text-[11px] font-medium text-white/45 tracking-wide">
            Navigate · Inform · Verify · Reach · Assist
          </p>

          {/* ── Right Quick Actions ── */}
          <div className="flex items-center gap-2">

            {/* Language Selector */}
            <label className="btn-secondary !py-1.5 !px-2.5 !gap-1 text-xs cursor-pointer" title="Language">
              <Globe className="w-3.5 h-3.5 text-amber-300" />
              <select
                value={lang}
                onChange={e => setLang(e.target.value)}
                className="bg-transparent text-xs outline-none cursor-pointer text-white"
                aria-label="Language"
              >
                {LANGUAGES.map(l => <option key={l.code} value={l.code} style={{ background: '#17132a' }}>{l.label}</option>)}
              </select>
            </label>

            {/* SOS Emergency Helpline */}
            <button
              className="btn-emergency !py-2 !px-3 text-xs"
              onClick={() => setShowSOSModal(true)}
              title="Emergency Helplines"
            >
              <ShieldAlert className="w-4 h-4" />
              <span className="hidden sm:inline">SOS 112</span>
            </button>

            {/* Account */}
            <Link to={ROUTES.profile} className="btn-icon !p-0.5" title="Your profile" aria-label="Your profile">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-8 h-8 rounded-full object-cover"
                  onError={e => { e.target.onerror = null; e.target.src = avatarFallback(user.name); }}
                />
              ) : (
                <span className="w-8 h-8 rounded-full flex items-center justify-center"><User className="w-4 h-4" /></span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* ── SOS Helpline Modal ── */}
      {showSOSModal && (
        <ModalPortal><div
          className="modal-backdrop z-[200]"
          onClick={e => { if (e.target === e.currentTarget) setShowSOSModal(false); }}
          role="dialog"
          aria-modal="true"
          aria-label="National Emergency Helplines"
        >
          <div className="glass-panel glass-modal w-full max-w-md p-6" style={{ borderRadius: 'var(--r-xl)' }}>
            <button onClick={() => setShowSOSModal(false)} className="btn-icon absolute top-4 right-4" aria-label="Close">
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="service-icon-box" style={{ background: 'rgba(255,77,99,0.2)', color: '#FF4D63' }}>
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-white">{t.sos_title}</h3>
                <p className="text-xs text-white/60">{t.sos_sub}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {HELPLINES.map(({ number, label, color }) => (
                <a key={number} href={`tel:${number}`} className="glass-card p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase mb-0.5" style={{ color }}>{t[label]}</p>
                    <p className="text-2xl font-black text-white font-display">{number}</p>
                  </div>
                  <PhoneCall className="w-5 h-5" style={{ color }} />
                </a>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-white/10">
              <SosContacts onNavigate={() => setShowSOSModal(false)} />
            </div>
          </div>
        </div></ModalPortal>
      )}
    </>
  );
}
