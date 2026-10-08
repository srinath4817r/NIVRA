// frontend/src/components/EligibilityChecker.jsx — "What am I eligible for?"
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { request } from '../services/http';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { SaveButton } from '../context/SavedContext';
import { ROUTES, trackState } from '../routes';
import { FormError } from './LoginScreen';
import { ListChecks, Check, X as XIcon, HelpCircle, Loader2, ExternalLink, BookmarkPlus, ChevronDown } from 'lucide-react';

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

const FIELDS = [
  { key: 'age', label: 'Age', type: 'number', placeholder: 'e.g. 19' },
  { key: 'gender', label: 'Gender', options: [['female', 'Female'], ['male', 'Male'], ['other', 'Other']] },
  { key: 'annualIncome', label: 'Family income per year (₹)', type: 'number', placeholder: 'e.g. 300000' },
  { key: 'category', label: 'Category', options: [['general', 'General'], ['obc', 'OBC / EBC / DNT'], ['sc', 'SC'], ['st', 'ST'], ['ews', 'EWS']] },
  { key: 'educationLevel', label: 'Currently studying', options: [['school', 'School (up to Class 10)'], ['class11-12', 'Class 11–12'], ['diploma', 'Diploma / Polytechnic'], ['ug', 'Undergraduate degree'], ['pg', 'Postgraduate'], ['none', 'Not studying']] },
  { key: 'occupation', label: 'Main work', options: [['student', 'Student'], ['farmer', 'Farmer'], ['artisan', 'Artisan / craftsperson'], ['self-employed', 'Self-employed / street vendor'], ['salaried', 'Salaried'], ['unemployed', 'Looking for work'], ['other', 'Other']] },
  { key: 'state', label: 'State / UT', options: INDIAN_STATES.map(s => [s, s]) },
  { key: 'disability', label: 'Disability (40% or more)', options: [['yes', 'Yes'], ['no', 'No']] },
];

const STATUS = {
  eligible: { label: 'Likely eligible', cls: 'badge-green' },
  likely: { label: 'Likely: confirm 1 condition', cls: 'badge-green' },
  maybe: { label: 'Answer more to check', cls: 'badge-saffron' },
  not_eligible: { label: 'Not eligible', cls: 'badge-red' },
};

const RESULT_ICON = {
  pass: <Check className="w-3.5 h-3.5 text-emerald-300 flex-shrink-0" aria-label="meets" />,
  fail: <XIcon className="w-3.5 h-3.5 text-red-300 flex-shrink-0" aria-label="does not meet" />,
  unknown: <HelpCircle className="w-3.5 h-3.5 text-white/40 flex-shrink-0" aria-label="not answered" />,
  confirm: <HelpCircle className="w-3.5 h-3.5 text-amber-300 flex-shrink-0" aria-label="confirm on the portal" />,
};

// form values are strings; the API wants typed values
function toProfile(form) {
  const p = {};
  for (const [k, v] of Object.entries(form)) {
    if (v === '' || v === undefined) continue;
    if (k === 'age' || k === 'annualIncome') p[k] = Number(v);
    else if (k === 'disability') p[k] = v === 'yes';
    else p[k] = v;
  }
  return p;
}
const fromProfile = (p = {}) => Object.fromEntries(FIELDS.map(f => [
  f.key, f.key === 'disability' ? (p.disability === undefined ? '' : p.disability ? 'yes' : 'no') : (p[f.key] ?? ''),
]));

function ResultCard({ r }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(r.status === 'eligible' || r.status === 'likely');
  const name = r.item.name || r.item.schemeName;
  const link = r.item.officialLink || r.item.officialSource;
  return (
    <article className="glass-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className={`badge ${STATUS[r.status].cls} !text-[9px]`}>{STATUS[r.status].label}</span>
            <span className="badge badge-purple !text-[9px] capitalize">{r.kind}</span>
          </div>
          {r.kind === 'scholarship'
            ? <Link to={ROUTES.scholarship(r.item.id)} className="font-extrabold text-white text-sm hover:underline">{name}</Link>
            : <h4 className="font-extrabold text-white text-sm">{name}</h4>}
          <p className="text-xs text-emerald-300 font-semibold mt-0.5">{r.item.amount || r.item.benefit || r.item.maxLoanAmount}</p>
        </div>
        <SaveButton itemId={r.item.id} name={name} />
      </div>

      <button onClick={() => setOpen(o => !o)} className="text-[11px] text-white/60 hover:text-white mt-2 flex items-center gap-1" aria-expanded={open}>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} /> Why
      </button>
      {open && (
        <>
          <ul className="mt-2 space-y-1">
            {r.checks.length === 0 && <li className="text-xs text-white/60">Eligibility depends on official lists. Check on the portal.</li>}
            {r.checks.map((c, i) => (
              <li key={i} className="text-xs text-white/75 flex items-center gap-2">
                {RESULT_ICON[c.result]} {c.rule}{c.result === 'confirm' && <span className="text-amber-200/80">(confirm on the portal)</span>}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 mt-3">
            {link && (
              <a href={link} target="_blank" rel="noreferrer" className="btn-secondary !py-1.5 !px-3 text-xs">
                Official portal <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <button onClick={() => navigate(ROUTES.profile, { state: trackState(r.item) })} className="btn-secondary !py-1.5 !px-3 text-xs">
              <BookmarkPlus className="w-3.5 h-3.5" /> Track
            </button>
          </div>
        </>
      )}
    </article>
  );
}

export default function EligibilityChecker() {
  const { user, updateProfile } = useAuth();
  const { t } = useLanguage();
  const [form, setForm] = useState(() => fromProfile(user?.profile));
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showNotEligible, setShowNotEligible] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    const profile = toProfile(form);
    try {
      const [res] = await Promise.all([
        request('/eligibility', { method: 'POST', body: { profile } }),
        // remember answers so the AI assistant and next visit can use them
        updateProfile({ profile }).catch(() => {}),
      ]);
      setData(res);
      setTimeout(() => document.getElementById('elig-results')?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const shown = (data?.results || []).filter(r => showNotEligible || r.status !== 'not_eligible');

  return (
    <div className="space-y-5 fade-in max-w-4xl mx-auto">
      <section className="glass-panel p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="service-icon-box" style={{ background: 'rgba(52,211,153,0.18)', color: '#34D399' }}><ListChecks className="w-6 h-6" /></div>
          <div>
            <h2 className="text-2xl font-black text-white">{t.elig_title}</h2>
            <p className="text-xs text-white/60">{t.elig_sub}</p>
          </div>
        </div>

        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FIELDS.map(f => (
            <label key={f.key} className="block">
              <span className="block text-xs font-bold text-white/70 mb-1">{f.label}</span>
              {f.options ? (
                <select value={form[f.key]} onChange={set(f.key)} className="input-glass text-sm !py-2.5">
                  <option value="">Prefer not to say</option>
                  {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ) : (
                <input type={f.type} inputMode="numeric" min={0} value={form[f.key]} onChange={set(f.key)} placeholder={f.placeholder} className="input-glass text-sm !py-2.5" />
              )}
            </label>
          ))}
          <div className="sm:col-span-2 space-y-2">
            <FormError message={error} />
            <button type="submit" disabled={busy} className="btn-primary w-full justify-center !py-3 text-sm">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListChecks className="w-4 h-4" />} {t.elig_button}
            </button>
            <p className="text-[10px] text-white/45 text-center">Your answers are saved to your profile. This is a guide based on the main published rules. Always confirm on the official portal.</p>
          </div>
        </form>
      </section>

      {data && (
        <section id="elig-results" className="space-y-3 scroll-mt-24">
          <div className="glass-panel p-4 grid grid-cols-3 text-center">
            <div><p className="text-2xl font-black text-emerald-300">{data.summary.eligible}</p><p className="text-[11px] text-white/60">likely eligible</p></div>
            <div><p className="text-2xl font-black text-amber-300">{data.summary.maybe}</p><p className="text-[11px] text-white/60">need more answers</p></div>
            <div><p className="text-2xl font-black text-white/50">{data.summary.notEligible}</p><p className="text-[11px] text-white/60">not eligible</p></div>
          </div>
          <div className="space-y-2.5 stagger">
            {shown.map(r => <ResultCard key={r.item.id} r={r} />)}
          </div>
          {data.summary.notEligible > 0 && (
            <button onClick={() => setShowNotEligible(s => !s)} className="text-xs text-white/50 hover:text-white px-1">
              {showNotEligible ? 'Hide' : 'Show'} {data.summary.notEligible} schemes you don't qualify for
            </button>
          )}
        </section>
      )}
    </div>
  );
}
