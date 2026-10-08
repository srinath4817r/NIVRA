// frontend/src/components/TrackerDashboard.jsx — Profile, application pipeline, saved items, reports
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { trackers as trackersApi, saved as savedApi, reports as reportsApi } from '../services/userApi';
import { useAuth } from '../context/AuthContext';
import { useSaved } from '../context/SavedContext';
import { useLanguage } from '../context/LanguageContext';
import { ROUTES } from '../routes';
import { FormError, EmailFlow } from './LoginScreen';
import { downloadIcs, daysUntil } from '../lib/ics';
import { findItemLink } from '../lib/items';
import {
  CheckCircle2, Circle, PlusCircle, X, MessageSquare, ChevronRight, LogOut, Trash2,
  BellRing, ClipboardList, Loader2, Bookmark, Megaphone, UserPlus, ShieldAlert,
  CalendarPlus, Pencil, Users, Phone, Plus
} from 'lucide-react';
import ModalPortal from './ModalPortal';

// Remembers which navigation hand-offs were consumed (survives StrictMode double effects)
const consumedTrackKeys = new Set();

function serviceToTracker(item) {
  return {
    itemId: item.id,
    title: item.name || item.schemeName || item.serviceName || 'Government Scheme',
    type: item.amount ? 'Scholarship' : (item.maxLoanAmount ? 'Education Loan' : 'Government Scheme'),
    // the real number comes from the portal after applying; the user can note it later
    referenceNo: 'Not yet applied',
    nextReminder: 'Apply on the official portal, then mark each step here',
  };
}

const STATUS_STYLE = {
  'Received': 'badge-saffron',
  'Verified': 'badge-blue',
  'Team Dispatched': 'badge-purple',
  'Resolved': 'badge-green',
};

function Section({ title, action, children, sectionRef }) {
  return (
    <section ref={sectionRef} className="space-y-3 pt-2 scroll-mt-24">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-base font-bold text-white">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function TrackerDashboard() {
  const { user, setShowLogoutConfirm, deleteAccount } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [trackers, setTrackers] = useState(null);
  const [savedItems, setSavedItems] = useState([]);
  const [myReports, setMyReports] = useState([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const pipelineRef = useRef(null);
  const reportsRef = useRef(null);

  const { trackItem, trackKey } = location.state || {};

  // Trackers added on this page are kept even if an older list response lands afterwards
  // (the initial list request and a "track this" hand-off run concurrently)
  const addedRef = useRef([]);
  const withAdded = (list) => [...addedRef.current.filter(a => !list.some(t => t.id === a.id)), ...list];

  useEffect(() => {
    trackersApi.list().then(list => setTrackers(withAdded(list))).catch(err => { setError(err.message); setTrackers(prev => prev || []); });
    savedApi.list().then(r => setSavedItems(r.data)).catch(() => {});
    reportsApi.mine().then(setMyReports).catch(() => {});
  }, []);

  // Consume a "track this service" hand-off from another screen (server de-duplicates per item)
  useEffect(() => {
    if (!trackItem || !trackKey || consumedTrackKeys.has(trackKey)) return;
    consumedTrackKeys.add(trackKey);
    navigate(location.pathname, { replace: true, state: null });

    trackersApi.add(serviceToTracker(trackItem))
      .then(({ tracker, duplicate }) => {
        setNotice(duplicate ? `You're already tracking “${tracker.title}”.` : `Now tracking “${tracker.title}”.`);
        if (!duplicate) {
          addedRef.current = [tracker, ...addedRef.current];
          setTrackers(prev => [tracker, ...(prev || []).filter(t => t.id !== tracker.id)]);
        }
      })
      .catch(err => setError(err.message));
  }, [trackItem, trackKey, navigate, location.pathname]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(id);
  }, [notice]);

  const toggleStep = async (tr, i) => {
    try {
      const updated = await trackersApi.setStep(tr.id, i, !tr.steps[i].done);
      setTrackers(prev => prev.map(t => (t.id === updated.id ? updated : t)));
    } catch (err) { setError(err.message); }
  };

  const removeTracker = async (id) => {
    const before = trackers;
    addedRef.current = addedRef.current.filter(t => t.id !== id);
    setTrackers(prev => prev.filter(t => t.id !== id));
    try { await trackersApi.remove(id); } catch (err) { setTrackers(before); setError(err.message); }
  };

  const { toggle: toggleSaved } = useSaved();
  const unsave = (id) => {
    setSavedItems(prev => prev.filter(s => s.item.id !== id));
    toggleSaved(id);
  };

  const MENU = [
    { icon: ClipboardList, label: t.my_applications, sub: `${trackers?.length ?? 0} being tracked`, color: '#5FD4FF', action: () => pipelineRef.current?.scrollIntoView({ behavior: 'smooth' }) },
    { icon: Megaphone,     label: t.my_reports,      sub: `${myReports.length} disaster report${myReports.length === 1 ? '' : 's'}`, color: '#FFB547', action: () => reportsRef.current?.scrollIntoView({ behavior: 'smooth' }) },
    { icon: MessageSquare, label: t.my_queries,      sub: 'Continue your AI assistant chat', color: '#C29BFF', action: () => navigate(ROUTES.assistant) },
    ...(user?.isAdmin ? [{ icon: ShieldAlert, label: 'Report Queue', sub: 'Review & update incoming reports', color: '#FF4D63', action: () => navigate(ROUTES.admin) }] : []),
    { icon: LogOut,        label: t.log_out,         sub: 'End your current session', color: '#FF4D63', action: () => setShowLogoutConfirm(true) },
  ];

  return (
    <div className="space-y-5 fade-in max-w-4xl mx-auto">

      {/* Profile header */}
      <section className="glass-panel p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-16 h-16 rounded-[20px] p-[2px] flex-shrink-0" style={{ background: 'var(--accent-grad)' }}>
            <img
              src={user?.avatar || '/guest_pfp.png'}
              alt=""
              className="w-full h-full rounded-[18px] object-cover bg-[#17132a]"
              onError={e => { e.target.onerror = null; e.target.src = '/guest_pfp.png'; }}
            />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-black text-white truncate">{user?.name}</h2>
            <p className="text-xs text-white/60 truncate">{user?.email || user?.phone || 'Guest session on this device'}</p>
            <span className="badge badge-saffron !text-[9px] mt-1.5 capitalize">{user?.provider} account</span>
          </div>
        </div>

        <button onClick={() => setShowAddModal(true)} className="btn-primary !py-2 !px-4 text-xs flex-shrink-0">
          <PlusCircle className="w-4 h-4" />
          <span className="hidden sm:inline">{t.track_application}</span>
        </button>
      </section>

      {user?.isGuest && (
        <section className="glass-card p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="service-icon-box !w-10 !h-10 !rounded-xl flex-shrink-0" style={{ background: 'rgba(169,112,255,0.2)', color: '#C29BFF' }}>
              <UserPlus className="w-5 h-5" />
            </div>
            <p className="text-xs text-white/75">You're browsing as a guest. Create an account to keep your trackers and reports on any device. Everything you've saved comes with you.</p>
          </div>
          <button onClick={() => setShowSignup(true)} className="btn-secondary !py-1.5 !px-3 text-xs flex-shrink-0">Create account</button>
        </section>
      )}

      {notice && (
        <div className="liquid-pill rounded-full px-4 py-2.5 text-xs font-semibold text-white flex items-center gap-2 fade-in" role="status">
          <BellRing className="w-4 h-4 text-amber-300" /> {notice}
        </div>
      )}
      <FormError message={error} />

      {/* Quick links */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {MENU.map(item => {
          const Icon = item.icon;
          return (
            <button key={item.label} onClick={item.action} className="glass-card p-3.5 flex items-center justify-between text-left">
              <div className="flex items-center gap-3">
                <div className="service-icon-box !w-10 !h-10 !rounded-xl" style={{ color: item.color, background: 'rgba(255,255,255,0.06)' }}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">{item.label}</h4>
                  <p className="text-[11px] text-white/50">{item.sub}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/40" />
            </button>
          );
        })}
      </section>

      {/* Application pipeline */}
      <Section title={t.pipeline} sectionRef={pipelineRef}>
        {trackers === null && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-amber-300" /></div>}

        {trackers?.length === 0 && (
          <div className="glass-panel p-8 text-center">
            <p className="text-sm text-white/60">You aren't tracking any applications yet.</p>
            <div className="flex justify-center gap-2 mt-4">
              <Link to={ROUTES.scholarships} className="btn-secondary text-xs">Find scholarships</Link>
              <button onClick={() => setShowAddModal(true)} className="btn-secondary text-xs"><PlusCircle className="w-4 h-4" /> Add manually</button>
            </div>
          </div>
        )}

        <div className="space-y-3 stagger">
          {trackers?.map(tr => {
            const pct = Math.round((tr.steps.filter(s => s.done).length / tr.steps.length) * 100);
            return (
              <article key={tr.id} className="glass-card p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <span className="badge badge-purple !text-[9px] mb-1">{tr.type}</span>
                    <h4 className="font-extrabold text-white text-sm">{tr.title}</h4>
                    <p className="text-[11px] font-mono text-white/50">
                      Ref: {tr.referenceNo} · Added {tr.appliedDate}
                    </p>
                  </div>
                  <button onClick={() => removeTracker(tr.id)} className="btn-icon !p-1.5 flex-shrink-0" title="Stop tracking" aria-label={`Stop tracking ${tr.title}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-3" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: 'var(--accent-grad)' }} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {tr.steps.map((st, i) => (
                    <button
                      key={i}
                      onClick={() => toggleStep(tr, i)}
                      className={`p-2.5 rounded-xl border text-left text-[10px] transition-colors ${st.done ? 'bg-emerald-400/15 border-emerald-300/30 text-emerald-200' : 'bg-white/5 border-white/10 text-white/45 hover:bg-white/10'}`}
                      aria-pressed={st.done}
                      title={st.done ? 'Mark as not done' : 'Mark as done'}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold uppercase tracking-wide">Step {i + 1}</span>
                        {st.done ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> : <Circle className="w-3.5 h-3.5 text-white/30" />}
                      </div>
                      <p className="font-bold text-white text-[11px] mt-0.5">{st.name}</p>
                      <p className="text-[10px] opacity-80">{st.date || 'Tap when done'}</p>
                    </button>
                  ))}
                </div>

                <p className="text-[11px] text-amber-300 font-semibold mt-3 flex items-center gap-1.5">
                  <BellRing className="w-3 h-3" /> {tr.currentStatus} · {tr.nextReminder}
                </p>

                <TrackerDetails tracker={tr} onSaved={updated => setTrackers(prev => prev.map(t => (t.id === updated.id ? updated : t)))} />
              </article>
            );
          })}
        </div>
      </Section>

      <EmergencyContacts />

      {/* Saved */}
      <Section title={t.saved_services}>
        {savedItems.length === 0 ? (
          <p className="text-xs text-white/50 px-1">Tap the bookmark on any scholarship or scheme to save it here.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {savedItems.map(({ item }) => (
              <div key={item.id} className="glass-card p-3.5 flex items-center justify-between gap-2">
                <Link to={item.id.startsWith('sch-') ? ROUTES.scholarship(item.id) : ROUTES.services} className="flex items-center gap-3 min-w-0">
                  <Bookmark className="w-4 h-4 text-amber-300 flex-shrink-0" />
                  <span className="text-sm font-bold text-white truncate">{item.name || item.schemeName}</span>
                </Link>
                <button onClick={() => unsave(item.id)} className="btn-icon !p-1.5" aria-label={`Remove ${item.name || item.schemeName} from saved`}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Reports */}
      <Section title={t.my_reports} sectionRef={reportsRef} action={<Link to={ROUTES.emergency} className="text-xs text-amber-300 font-semibold">New report</Link>}>
        {myReports.length === 0 ? (
          <p className="text-xs text-white/50 px-1">Disaster reports you submit appear here with their latest status.</p>
        ) : (
          <div className="space-y-2.5">
            {myReports.map(r => (
              <article key={r.id} className="glass-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="font-bold text-white text-sm">{r.category} · <span className="text-white/60 font-semibold">{r.location}</span></h4>
                    <p className="text-xs text-white/60 mt-0.5 line-clamp-2">{r.description}</p>
                    <p className="text-[10px] text-white/40 mt-1">{new Date(r.reportedAt).toLocaleString()}</p>
                  </div>
                  <span className={`badge ${STATUS_STYLE[r.status] || 'badge-red'} !text-[9px] flex-shrink-0`}>{r.status}</span>
                </div>
                {r.statusHistory?.length > 1 && (
                  <ol className="mt-3 pt-3 border-t border-white/10 space-y-1">
                    {r.statusHistory.map((h, i) => (
                      <li key={i} className="text-[11px] text-white/60 flex gap-2">
                        <span className="text-white/40 font-mono">{new Date(h.at).toLocaleDateString()}</span>
                        <span className="text-white/80 font-semibold">{h.status}</span>
                        {h.note && <span className="text-white/50">— {h.note}</span>}
                      </li>
                    ))}
                  </ol>
                )}
              </article>
            ))}
          </div>
        )}
      </Section>

      {/* Danger zone */}
      <section className="pt-4">
        {confirmDelete ? (
          <div className="glass-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-white/70">Permanently delete your account, trackers, saved items and uploaded photos?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary !py-1.5 text-xs">Cancel</button>
              <button onClick={() => deleteAccount().catch(err => setError(err.message))} className="btn-emergency !animate-none !py-1.5 text-xs">Delete forever</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="text-xs text-white/40 hover:text-red-300 px-1">Delete my account</button>
        )}
      </section>

      {/* Signing up from the guest session moves the guest's data to the new account */}
      {showSignup && <EmailFlow initialMode="signup" onClose={() => setShowSignup(false)} />}

      {showAddModal && (
        <AddTrackerModal
          onClose={() => setShowAddModal(false)}
          onAdded={(t) => { addedRef.current = [t, ...addedRef.current]; setTrackers(prev => [t, ...(prev || [])]); setShowAddModal(false); }}
        />
      )}
    </div>
  );
}

function AddTrackerModal({ onClose, onAdded }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('Scholarship');
  const [referenceNo, setReferenceNo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const { tracker } = await trackersApi.add({ title, type, referenceNo });
      onAdded(tracker);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <ModalPortal><div className="modal-backdrop z-[150]" onClick={e => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-label="Track application">
      <div className="glass-panel glass-modal p-6 max-w-md w-full" style={{ borderRadius: 'var(--r-xl)' }}>
        <button onClick={onClose} className="btn-icon absolute top-4 right-4" aria-label="Close"><X className="w-4 h-4" /></button>
        <h3 className="text-lg font-extrabold text-white mb-4">Track Application</h3>
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="block text-xs font-bold text-white/70 mb-1">Scheme / Service name</span>
            <input type="text" required placeholder="e.g. NSP Scholarship 2026" value={title} onChange={e => setTitle(e.target.value)} className="input-glass text-sm !py-2.5" />
          </label>
          <label className="block">
            <span className="block text-xs font-bold text-white/70 mb-1">Type</span>
            <select value={type} onChange={e => setType(e.target.value)} className="input-glass text-sm !py-2.5">
              <option>Scholarship</option>
              <option>Education Loan</option>
              <option>Government Scheme</option>
              <option>Certificate</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-bold text-white/70 mb-1">Reference / registration number</span>
            <input type="text" required placeholder="e.g. NSP/2026/89412" value={referenceNo} onChange={e => setReferenceNo(e.target.value)} className="input-glass text-sm !py-2.5 font-mono" />
          </label>
          <FormError message={error} />
          <button type="submit" disabled={busy} className="btn-primary w-full justify-center !py-3 text-sm">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save to Tracker'}
          </button>
        </form>
      </div>
    </div></ModalPortal>
  );
}

// Real deadline + portal reference number, recorded by the user, with a calendar reminder
function TrackerDetails({ tracker, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [deadline, setDeadline] = useState(tracker.deadline || '');
  const [referenceNo, setReferenceNo] = useState(tracker.referenceNo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const updated = await trackersApi.update(tracker.id, { deadline: deadline || null, referenceNo: referenceNo.trim() || tracker.referenceNo });
      onSaved(updated);
      setEditing(false);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const days = tracker.deadline ? daysUntil(tracker.deadline) : null;
  const urgency = days === null ? '' : days < 0 ? 'badge-red' : days <= 7 ? 'badge-saffron' : 'badge-blue';

  if (editing) {
    return (
      <form onSubmit={save} className="mt-3 pt-3 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
        <label className="block">
          <span className="block text-[11px] font-bold text-white/60 mb-1">Deadline (from the portal)</span>
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="input-glass text-xs !py-2" />
        </label>
        <label className="block">
          <span className="block text-[11px] font-bold text-white/60 mb-1">Application / reference no.</span>
          <input value={referenceNo} onChange={e => setReferenceNo(e.target.value)} maxLength={80} className="input-glass text-xs !py-2 font-mono" />
        </label>
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="btn-primary !py-2 !px-4 text-xs flex-1 justify-center">{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}</button>
          <button type="button" onClick={() => setEditing(false)} className="btn-secondary !py-2 !px-3 text-xs">Cancel</button>
        </div>
        <div className="sm:col-span-3"><FormError message={error} /></div>
      </form>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center gap-2">
      {tracker.deadline ? (
        <span className={`badge ${urgency} !text-[10px] !normal-case`}>
          Deadline {new Date(`${tracker.deadline}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          {' · '}{days < 0 ? 'passed' : days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} left`}
        </span>
      ) : (
        <span className="text-[11px] text-white/45">No deadline set</span>
      )}
      <button onClick={() => setEditing(true)} className="btn-secondary !py-1 !px-2.5 text-[11px]"><Pencil className="w-3 h-3" /> {tracker.deadline ? 'Edit' : 'Add deadline & ref no.'}</button>
      {tracker.deadline && days >= 0 && (
        <button onClick={() => downloadIcs(tracker, findItemLink(tracker.itemId))} className="btn-secondary !py-1 !px-2.5 text-[11px]">
          <CalendarPlus className="w-3 h-3" /> Add to calendar
        </button>
      )}
    </div>
  );
}

// Who to alert from the SOS button
function EmergencyContacts() {
  const { user, updateProfile } = useAuth();
  const { t } = useLanguage();
  const [contacts, setContacts] = useState(user?.emergencyContacts || []);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const persist = async (next) => {
    setBusy(true); setError('');
    try {
      const u = await updateProfile({ emergencyContacts: next });
      setContacts(u.emergencyContacts);
      return true;
    } catch (err) { setError(err.message); return false; } finally { setBusy(false); }
  };

  const add = async (e) => {
    e.preventDefault();
    if (await persist([...contacts, { name: name.trim(), phone: phone.trim() }])) { setName(''); setPhone(''); }
  };

  return (
    <Section title={t.emergency_contacts}>
      <div className="glass-panel p-4 space-y-3">
        <p className="text-xs text-white/60 flex items-start gap-2"><Users className="w-4 h-4 flex-shrink-0 text-red-300" /> The SOS button can send these people a message with your live location. Up to 5 contacts.</p>
        {contacts.length > 0 && (
          <ul className="space-y-2">
            {contacts.map((c, i) => (
              <li key={`${c.phone}-${i}`} className="glass-well px-3 py-2 flex items-center justify-between gap-2">
                <span className="text-sm text-white font-semibold">{c.name} <span className="text-white/50 font-mono text-xs">{c.phone}</span></span>
                <div className="flex gap-1.5">
                  <a href={`tel:${c.phone.replace(/[\s-]/g, '')}`} className="btn-icon !p-1.5" aria-label={`Call ${c.name}`}><Phone className="w-3.5 h-3.5" /></a>
                  <button onClick={() => persist(contacts.filter((_, j) => j !== i))} disabled={busy} className="btn-icon !p-1.5" aria-label={`Remove ${c.name}`}><X className="w-3.5 h-3.5" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {contacts.length < 5 && (
          <form onSubmit={add} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
            <input required maxLength={60} value={name} onChange={e => setName(e.target.value)} placeholder="Name (e.g. Amma)" aria-label="Contact name" className="input-glass text-sm !py-2.5" />
            <input required type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98480 22338" aria-label="Contact phone" className="input-glass text-sm !py-2.5" />
            <button type="submit" disabled={busy} className="btn-secondary justify-center text-xs"><Plus className="w-4 h-4" /> Add</button>
          </form>
        )}
        <FormError message={error} />
      </div>
    </Section>
  );
}
