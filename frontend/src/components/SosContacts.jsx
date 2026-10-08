// frontend/src/components/SosContacts.jsx — send your live location to emergency contacts
// Uses the phone's own SMS app / share sheet: no SMS provider needed and it works on any plan.
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useLocationCtx } from '../context/LocationContext';
import { ROUTES } from '../routes';
import { MessageSquareWarning, Loader2, Share2, Send } from 'lucide-react';

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('unsupported'));
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      reject,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

// `?&body=` is the form both Android and iOS Messages accept
const smsHref = (phone, body) => `sms:${phone.replace(/[\s-]/g, '')}?&body=${encodeURIComponent(body)}`;

export default function SosContacts({ onNavigate }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { location: saved } = useLocationCtx();
  const contacts = user?.emergencyContacts || [];
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const prepare = async () => {
    setBusy(true);
    let pos = null;
    try { pos = await getPosition(); } catch { pos = saved ? { lat: saved.lat, lng: saved.lng } : null; }
    const where = pos
      ? `My location: https://maps.google.com/?q=${pos.lat.toFixed(5)},${pos.lng.toFixed(5)}${pos.accuracy ? ` (±${pos.accuracy} m)` : ' (last known)'}`
      : "I couldn't share my location. Please call me.";
    setMessage(`🚨 EMERGENCY — ${user?.name || 'I'} need${user?.name ? 's' : ''} help. ${where}. Sent from NIVRA at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`);
    setBusy(false);
  };

  if (!contacts.length) {
    return (
      <div className="glass-well p-3 text-xs text-white/70">
        Add family or friends as emergency contacts and this button will message them your live location.{' '}
        <Link to={ROUTES.profile} onClick={onNavigate} className="text-amber-200 font-bold underline">Add contacts</Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!message ? (
        <button onClick={prepare} disabled={busy} className="btn-emergency !animate-none w-full justify-center !py-3 text-sm">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquareWarning className="w-4 h-4" />}
          {t.sos_alert} ({contacts.length})
        </button>
      ) : (
        <>
          <p className="glass-well p-3 text-xs text-white/80">{message}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {contacts.map(c => (
              <a key={c.phone} href={smsHref(c.phone, message)} className="btn-secondary justify-center text-xs">
                <Send className="w-3.5 h-3.5 text-red-300" /> SMS {c.name}
              </a>
            ))}
            {typeof navigator.share === 'function' && (
              <button onClick={() => navigator.share({ text: message }).catch(() => {})} className="btn-secondary justify-center text-xs">
                <Share2 className="w-3.5 h-3.5" /> WhatsApp / other apps
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
