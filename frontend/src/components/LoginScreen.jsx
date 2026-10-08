// frontend/src/components/LoginScreen.jsx — NIVRA Liquid Glass Login
import React, { useState, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage, LANGUAGES } from '../context/LanguageContext';
import GoogleSignInButton from './GoogleSignInButton';
import { Smartphone, Mail, ArrowRight, X, CheckCircle2, Loader2, KeyRound, AlertCircle, Eye, EyeOff } from 'lucide-react';
import ModalPortal from './ModalPortal';

const OTP_LENGTH = 6;

function Modal({ children, onClose, locked, label }) {
  return (
    <ModalPortal><div
      className="modal-backdrop z-[1000]"
      onClick={e => { if (!locked && e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div className="glass-panel glass-modal w-full max-w-sm p-6" style={{ borderRadius: 'var(--r-xl)' }}>
        {!locked && (
          <button onClick={onClose} className="btn-icon absolute top-4 right-4" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        )}
        {children}
      </div>
    </div></ModalPortal>
  );
}

export function FormError({ message }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs text-red-200 bg-red-500/15 border border-red-400/30 rounded-xl px-3 py-2 flex items-start gap-2">
      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-px" /> {message}
    </p>
  );
}

export function MobileFlow({ onClose }) {
  const { requestOtp, verifyOtp, authConfig } = useAuth();
  const [step, setStep] = useState('number'); // number | code
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState(Array(OTP_LENGTH).fill(''));
  const [devCode, setDevCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refs = useRef([]);

  const valid = /^[6-9]\d{9}$/.test(phone);

  const send = async (e) => {
    e?.preventDefault();
    if (!valid || busy) return;
    setBusy(true); setError('');
    try {
      const res = await requestOtp(phone);
      setDevCode(res.devCode || '');
      setCode(Array(OTP_LENGTH).fill(''));
      setStep('code');
      setTimeout(() => refs.current[0]?.focus(), 50);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (digits) => {
    const value = digits.join('');
    if (value.length !== OTP_LENGTH || busy) return;
    setBusy(true); setError('');
    try {
      await verifyOtp(phone, value);  // success unmounts the login screen
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const onDigit = (idx, raw) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) { setCode(c => c.map((d, i) => (i === idx ? '' : d))); return; }
    // supports pasting the whole code into any box
    const next = [...code];
    for (let i = 0; i < digits.length && idx + i < OTP_LENGTH; i++) next[idx + i] = digits[i];
    setCode(next);
    refs.current[Math.min(idx + digits.length, OTP_LENGTH - 1)]?.focus();
    if (next.every(Boolean)) verify(next);
  };

  return (
    <Modal onClose={onClose} locked={busy && step === 'code'} label="Sign in with mobile">
      {step === 'code' ? (
        <form onSubmit={e => { e.preventDefault(); verify(code); }} className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <KeyRound className="w-5 h-5 text-amber-300" />
            <div>
              <h3 className="font-display font-extrabold text-white text-base">Enter verification code</h3>
              <p className="text-[11px] text-white/60">Sent by SMS to +91 {phone}</p>
            </div>
          </div>

          <div className="flex justify-center gap-1.5 sm:gap-2">
            {code.map((digit, idx) => (
              <input
                key={idx}
                ref={el => (refs.current[idx] = el)}
                inputMode="numeric"
                autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                value={digit}
                onChange={e => onDigit(idx, e.target.value)}
                onKeyDown={e => { if (e.key === 'Backspace' && !code[idx] && idx > 0) refs.current[idx - 1]?.focus(); }}
                aria-label={`Digit ${idx + 1}`}
                className="input-glass !w-11 !h-13 !p-0 !rounded-2xl text-center text-xl font-black font-mono"
              />
            ))}
          </div>

          {devCode && (
            <p className="text-[11px] text-center text-amber-200/90 bg-amber-400/10 border border-amber-300/20 rounded-xl px-3 py-2">
              Development mode (no SMS provider configured): your code is <b className="font-mono tracking-widest">{devCode}</b>
            </p>
          )}
          <FormError message={error} />

          <button type="submit" disabled={busy || code.some(d => !d)} className="btn-primary w-full justify-center !py-3 text-sm">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Verify & continue
          </button>
          <div className="flex justify-between text-xs">
            <button type="button" onClick={() => { setStep('number'); setError(''); }} className="text-white/60 hover:text-white">Change number</button>
            <button type="button" onClick={send} disabled={busy} className="text-amber-200 hover:text-white">Resend code</button>
          </div>
        </form>
      ) : (
        <form onSubmit={send} className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-amber-300" />
            <h3 className="font-display font-extrabold text-white text-base">Sign in with mobile</h3>
          </div>
          <label className="block">
            <span className="block text-[11px] font-bold text-white/70 mb-1.5">10-digit mobile number</span>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-extrabold text-amber-300 z-10">+91</span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                required
                autoFocus
                placeholder="98765 43210"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="input-glass !pl-12 font-mono"
              />
            </div>
            {phone.length === 10 && !valid && (
              <span className="block text-[11px] text-red-300 mt-1.5">Indian mobile numbers start with 6–9.</span>
            )}
          </label>
          {authConfig.mobileDevMode && (
            <p className="text-[10px] text-white/45">No SMS provider is configured, so the code will be shown on screen.</p>
          )}
          <FormError message={error} />
          <button type="submit" disabled={!valid || busy} className="btn-primary w-full justify-center !py-3 text-sm">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send code <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>
      )}
    </Modal>
  );
}

export function EmailFlow({ onClose, initialMode = 'signin' }) {
  const { loginWithEmail, register } = useAuth();
  const [mode, setMode] = useState(initialMode); // signin | signup
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      if (mode === 'signup') await register(name, email, password);
      else await loginWithEmail(email, password);
      onClose();   // no-op on the login screen (it unmounts); closes the dialog when upgrading a guest
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} locked={busy} label="Sign in with email">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <Mail className="w-5 h-5 text-purple-300" />
          <h3 className="font-display font-extrabold text-white text-base">{mode === 'signup' ? 'Create your account' : 'Sign in with email'}</h3>
        </div>

        <div className="liquid-pill rounded-full p-1 grid grid-cols-2 gap-1" role="tablist">
          {[['signin', 'Sign in'], ['signup', 'Create account']].map(([m, label]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => { setMode(m); setError(''); }}
              className={`py-1.5 rounded-full text-xs font-bold transition-all ${mode === m ? 'bg-white/90 text-slate-900' : 'text-white/70 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'signup' && (
          <label className="block">
            <span className="block text-[11px] font-bold text-white/70 mb-1.5">Full name</span>
            <input required autoComplete="name" value={name} onChange={e => setName(e.target.value)} className="input-glass" placeholder="Asha Rao" />
          </label>
        )}
        <label className="block">
          <span className="block text-[11px] font-bold text-white/70 mb-1.5">Email address</span>
          <input type="email" required autoFocus autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="input-glass" placeholder="you@example.com" />
        </label>
        <label className="block">
          <span className="block text-[11px] font-bold text-white/70 mb-1.5">Password</span>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              required
              minLength={mode === 'signup' ? 8 : 1}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input-glass !pr-11"
              placeholder={mode === 'signup' ? 'At least 8 characters' : ''}
            />
            <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white" aria-label={showPw ? 'Hide password' : 'Show password'}>
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </label>

        <FormError message={error} />
        <button type="submit" disabled={busy} className="btn-primary w-full justify-center !py-3 text-sm">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{mode === 'signup' ? 'Create account' : 'Sign in'} <ArrowRight className="w-4 h-4" /></>}
        </button>
      </form>
    </Modal>
  );
}

export default function LoginScreen() {
  const { loginWithGoogle, loginAsGuest, authConfig, bootError, retryBoot } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const [activeModal, setActiveModal] = useState(null); // 'mobile' | 'email' | null
  const [error, setError] = useState('');
  const [guestBusy, setGuestBusy] = useState(false);

  const onGoogle = useCallback(async (credential) => {
    setError('');
    try { await loginWithGoogle(credential); } catch (err) { setError(err.message); }
  }, [loginWithGoogle]);

  const onGuest = async () => {
    setGuestBusy(true); setError('');
    try { await loginAsGuest(); } catch (err) { setError(err.message); setGuestBusy(false); }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4 liquid-pill rounded-full p-1 flex gap-0.5 overflow-x-auto max-w-[calc(100vw-2rem)] no-scrollbar" role="group" aria-label="Language">
        {LANGUAGES.map(l => (
          <button
            key={l.code}
            onClick={() => setLang(l.code)}
            aria-pressed={lang === l.code}
            className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${lang === l.code ? 'bg-white/90 text-slate-900' : 'text-white/70'}`}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* Brand */}
      <div className="flex flex-col items-center text-center mb-7 w-full max-w-[400px] fade-in">
        <img
          src="/nivra_logo.png"
          alt="NIVRA Logo"
          className="w-20 h-20 rounded-[24px] object-cover mb-4"
          style={{ border: '1px solid rgba(255,255,255,0.35)', boxShadow: '0 18px 40px -10px rgba(255,140,90,0.55)' }}
        />
        <h1 className="font-display font-black text-4xl text-white tracking-tight">NIVRA</h1>
        <p className="text-[11px] font-extrabold text-amber-200 tracking-[0.18em] uppercase mt-2">
          Navigate · Inform · Verify · Reach · Assist
        </p>
        <p className="text-sm font-medium text-white/75 mt-1.5">{t.login_tagline}</p>
      </div>

      {/* Card */}
      <div className="glass-panel w-full max-w-[400px] p-6 fade-in" style={{ borderRadius: 'var(--r-xl)', animationDelay: '0.08s' }}>
        {bootError ? (
          <div className="flex flex-col gap-3">
            <FormError message={bootError} />
            <button onClick={retryBoot} className="btn-secondary w-full justify-center">Try again</button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {authConfig.googleClientId && (
              <GoogleSignInButton clientId={authConfig.googleClientId} onCredential={onGoogle} onError={setError} />
            )}

            {authConfig.mobileEnabled && (
              <button onClick={() => setActiveModal('mobile')} className="btn-secondary w-full justify-center !py-3.5 text-sm">
                <Smartphone className="w-[18px] h-[18px] text-amber-300" />
                {t.login_mobile}
              </button>
            )}

            <button onClick={() => setActiveModal('email')} className="btn-secondary w-full justify-center !py-3.5 text-sm">
              <Mail className="w-[18px] h-[18px] text-purple-300" />
              {t.login_email}
            </button>

            <div className="flex items-center gap-3 my-1">
              <div className="h-px flex-1 bg-white/15" />
              <span className="text-[10px] font-extrabold text-white/45 tracking-[0.2em]">OR</span>
              <div className="h-px flex-1 bg-white/15" />
            </div>

            <button onClick={onGuest} disabled={guestBusy} className="btn-primary w-full justify-center !py-3.5 text-sm">
              {guestBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{t.login_guest} <ArrowRight className="w-[18px] h-[18px]" /></>}
            </button>
            <p className="text-[10px] text-center text-white/45 -mt-1">Guest data stays on this device. Create an account later to keep it.</p>

            <FormError message={error} />
          </div>
        )}

        <p className="text-[11px] text-center text-white/50 mt-5 leading-relaxed">
          By continuing, you agree to NIVRA's{' '}
          <span className="text-amber-200 font-semibold underline underline-offset-2">Terms of Service</span> &{' '}
          <span className="text-amber-200 font-semibold underline underline-offset-2">Privacy Policy</span>
        </p>
      </div>

      <p className="text-[11px] text-white/40 text-center mt-6">NIVRA Platform • One Place. Every Service.</p>

      {activeModal === 'mobile' && <MobileFlow onClose={() => setActiveModal(null)} />}
      {activeModal === 'email' && <EmailFlow onClose={() => setActiveModal(null)} />}
    </div>
  );
}
