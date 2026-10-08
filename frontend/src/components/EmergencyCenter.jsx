// frontend/src/components/EmergencyCenter.jsx — real location, weather, alerts and nearby help
import React, { useState, useEffect, useCallback } from 'react';
import { getJSON } from '../services/http';
import { analyzePhoto } from '../services/api';
import { reports } from '../services/userApi';
import { useLocationCtx } from '../context/LocationContext';
import FacilityMap, { TYPE_STYLE } from './FacilityMap';
import { FormError } from './LoginScreen';
import useDebounce from '../hooks/useDebounce';
import { useLanguage } from '../context/LanguageContext';
import {
  ShieldAlert, PhoneCall, Navigation, Crosshair, Search, Loader2, CloudRain, Thermometer,
  Droplets, Wind, AlertTriangle, Megaphone, X, CheckCircle2, ScanEye, Radio, MapPin, ExternalLink,
} from 'lucide-react';
import ModalPortal from './ModalPortal';

const HELPLINES = [
  { number: '112', label: 'hl_all' },
  { number: '108', label: 'hl_ambulance' },
  { number: '100', label: 'hl_police' },
  { number: '101', label: 'hl_fire' },
  { number: '1070', label: 'hl_disaster' },
  { number: '1098', label: 'hl_child' },
  { number: '181', label: 'hl_women' },
];

const FILTERS = [
  ['all', 'All'], ['hospital', 'Hospitals'], ['police', 'Police'], ['fire', 'Fire'], ['pharmacy', 'Pharmacies'], ['shelter', 'Shelters'],
];

const LEVEL_STYLE = {
  red: 'border-red-400/50 bg-red-500/15 text-red-100',
  orange: 'border-orange-300/50 bg-orange-500/15 text-orange-100',
  yellow: 'border-yellow-300/40 bg-yellow-400/10 text-yellow-50',
};

const openDirections = (f) =>
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}`, '_blank', 'noopener');

// ─────────────── Location picker ───────────────
function LocationBar() {
  const { location, status, error, locateMe, choosePlace } = useLocationCtx();
  const { t } = useLanguage();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounced = useDebounce(q.trim(), 300);

  useEffect(() => {
    if (debounced.length < 2) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    getJSON('/geo/search', { q: debounced })
      .then(r => { if (!cancelled) setResults(r.results); })
      .catch(() => { if (!cancelled) setResults([]); })
      .finally(() => { if (!cancelled) setSearching(false); });
    return () => { cancelled = true; };
  }, [debounced]);

  return (
    <section className="glass-panel p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="service-icon-box flex-shrink-0" style={{ background: 'rgba(255,181,71,0.18)', color: '#FFB547' }}>
            <MapPin className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="eyebrow">{location ? (location.source === 'gps' ? 'Your location' : 'Selected place') : 'Location'}</p>
            <h2 className="font-extrabold text-white text-base truncate">{location?.label || 'Not set yet'}</h2>
            {location?.accuracyM && <p className="text-[11px] text-white/45">GPS accurate to ~{location.accuracyM} m</p>}
          </div>
        </div>
        <button onClick={locateMe} disabled={status === 'locating'} className="btn-primary !py-2 !px-4 text-xs self-start sm:self-center">
          {status === 'locating' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
          {location?.source === 'gps' ? t.update_location : t.use_location}
        </button>
      </div>

      <div className="relative">
        <div className="search-glow-wrapper">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/40 z-10 pointer-events-none" />
          <input
            type="search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={t.search_place}
            aria-label="Search for a place"
            className="input-glass pl-11 py-2.5 text-xs"
          />
        </div>
        {(results.length > 0 || searching) && (
          <ul className="absolute left-0 right-0 top-full mt-2 z-[500] glass-panel glass-modal p-1.5 max-h-64 overflow-y-auto" role="listbox">
            {searching && <li className="px-3 py-2 text-xs text-white/50">Searching…</li>}
            {results.map(r => (
              <li key={`${r.lat},${r.lng}`}>
                <button
                  onClick={() => { choosePlace(r); setQ(''); setResults([]); }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 text-sm text-white"
                  role="option"
                  aria-selected="false"
                >
                  {r.name} <span className="text-white/50 text-xs">{[r.district !== r.name && r.district, r.state].filter(Boolean).join(', ')}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <FormError message={error} />
    </section>
  );
}

// ─────────────── Weather + alerts ───────────────
function ConditionsPanel({ location }) {
  const { t } = useLanguage();
  const [weather, setWeather] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setWeather(null); setError('');
    getJSON('/geo/weather', { lat: location.lat, lng: location.lng })
      .then(w => { if (!cancelled) setWeather(w); })
      .catch(err => { if (!cancelled) setError(err.message); });
    setAlerts(null);
    getJSON('/geo/alerts', { state: location.state || undefined })
      .then(a => { if (!cancelled) setAlerts(a.alerts); })
      .catch(() => { if (!cancelled) setAlerts(false); });
    return () => { cancelled = true; };
  }, [location.lat, location.lng, location.state]);

  return (
    <>
      <section className="glass-panel p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-white">{t.weather_now}</h3>
          {weather && <a href={weather.source.url} target="_blank" rel="noreferrer" className="text-[10px] text-white/40">Source: {weather.source.name}</a>}
        </div>
        {error && <FormError message={error} />}
        {!weather && !error && <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-amber-300" /></div>}
        {weather && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="glass-well p-3">
              <p className="eyebrow flex items-center gap-1"><Thermometer className="w-3 h-3" /> Temp</p>
              <p className="text-xl font-black text-amber-200">{Math.round(weather.current.temperature)}°C</p>
              <p className="text-[11px] text-white/50">feels {Math.round(weather.current.feelsLike)}°C · {weather.current.condition}</p>
            </div>
            <div className="glass-well p-3">
              <p className="eyebrow flex items-center gap-1"><CloudRain className="w-3 h-3" /> Rain today</p>
              <p className="text-xl font-black text-cyan-200">{Math.round(weather.today.rainMm ?? 0)} mm</p>
              <p className="text-[11px] text-white/50">{weather.today.rainChance ?? 0}% chance</p>
            </div>
            <div className="glass-well p-3">
              <p className="eyebrow flex items-center gap-1"><Droplets className="w-3 h-3" /> Humidity</p>
              <p className="text-xl font-black text-white">{weather.current.humidity}%</p>
            </div>
            <div className="glass-well p-3">
              <p className="eyebrow flex items-center gap-1"><Wind className="w-3 h-3" /> Wind</p>
              <p className="text-xl font-black text-white">{Math.round(weather.current.windSpeed)} <span className="text-xs">km/h</span></p>
            </div>
          </div>
        )}
      </section>

      {weather?.advisories?.length > 0 && (
        <section className="space-y-2">
          {weather.advisories.map(a => (
            <div key={a.type} className={`rounded-2xl border px-4 py-3 ${LEVEL_STYLE[a.level]}`} role="alert">
              <p className="font-extrabold text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {a.title}</p>
              <p className="text-xs opacity-90 mt-0.5">{a.detail}</p>
              <p className="text-[10px] opacity-60 mt-1">Forecast-based guidance, not an official warning. Follow IMD and local authority instructions.</p>
            </div>
          ))}
        </section>
      )}

      <section className="glass-panel p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold text-white flex items-center gap-2"><Radio className="w-4 h-4 text-red-300" /> {t.official_alerts}{location.state ? ` · ${location.state}` : ''}</h3>
          <a href="https://sachet.ndma.gov.in" target="_blank" rel="noreferrer" className="text-[10px] text-white/40">NDMA SACHET</a>
        </div>
        {alerts === null && <p className="text-xs text-white/50">Checking for alerts…</p>}
        {alerts === false && <p className="text-xs text-white/50">Official alerts couldn't be loaded right now. Check <a className="text-amber-200 underline" href="https://sachet.ndma.gov.in" target="_blank" rel="noreferrer">sachet.ndma.gov.in</a>.</p>}
        {alerts?.length === 0 && <p className="text-xs text-white/60">No official alerts in the last 48 hours{location.state ? ` for ${location.state}` : ''}.</p>}
        {alerts?.length > 0 && (
          <ul className="space-y-2">
            {alerts.slice(0, 5).map((a, i) => (
              <li key={i} className="glass-well p-3">
                <p className="text-sm font-bold text-white">{a.title}</p>
                {a.description && <p className="text-xs text-white/70 mt-0.5 line-clamp-3">{a.description}</p>}
                <p className="text-[10px] text-white/40 mt-1">
                  {a.published && new Date(a.published).toLocaleString()}
                  {a.link && <> · <a href={a.link} target="_blank" rel="noreferrer" className="text-amber-200">details</a></>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

// ─────────────── Nearby facilities ───────────────
function NearbyHelp({ location }) {
  const { t } = useLanguage();
  const [facilities, setFacilities] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setFacilities(null); setError('');
    getJSON('/geo/facilities', { lat: location.lat, lng: location.lng, radiusKm: 5 })
      .then(r => { if (!cancelled) setFacilities(r.facilities); })
      .catch(err => { if (!cancelled) { setError(err.message); setFacilities([]); } });
    return () => { cancelled = true; };
  }, [location.lat, location.lng]);

  const select = useCallback((id) => {
    setSelectedId(id);
    document.getElementById(`fac-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  const visible = (facilities || []).filter(f => filter === 'all' || f.type === filter);
  const counts = (facilities || []).reduce((acc, f) => ({ ...acc, [f.type]: (acc[f.type] || 0) + 1 }), {});

  return (
    <section className="glass-panel p-4 space-y-3">
      <div>
        <h3 className="text-base font-bold text-white">{t.help_near_you}</h3>
        <p className="text-xs text-white/55">Within 5 km, from OpenStreetMap. Details can be out of date. Call ahead when you can.</p>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {FILTERS.map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} className={`chip ${filter === key ? 'active' : ''}`}>
            {key !== 'all' && <span aria-hidden="true">{TYPE_STYLE[key].emoji}</span>}
            {label}{key !== 'all' && counts[key] ? ` (${counts[key]})` : ''}
          </button>
        ))}
      </div>

      <FacilityMap center={location} facilities={visible} selectedId={selectedId} onSelect={select} />

      {facilities === null && <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-amber-300" /></div>}
      <FormError message={error} />
      {facilities && !error && visible.length === 0 && (
        <p className="text-xs text-white/60 text-center py-3">Nothing of this type is mapped within 5 km. In an emergency call 112.</p>
      )}

      <ul className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
        {visible.slice(0, 30).map(f => (
          <li
            key={f.id}
            id={`fac-${f.id}`}
            className={`glass-card p-3 flex items-center justify-between gap-3 cursor-pointer ${selectedId === f.id ? 'ring-1 ring-amber-300/60' : ''}`}
            onClick={() => setSelectedId(f.id)}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xl flex-shrink-0" aria-hidden="true">{TYPE_STYLE[f.type].emoji}</span>
              <div className="min-w-0">
                <h4 className="font-bold text-white text-sm truncate">{f.name}</h4>
                <p className="text-[11px] text-white/55 truncate">
                  {f.typeLabel} · {f.distanceKm} km{f.emergency ? ' · 24×7 emergency' : ''}{f.address ? ` · ${f.address}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {f.phone && (
                <a href={`tel:${f.phone.split(/[;,/]/)[0].trim()}`} onClick={e => e.stopPropagation()} className="btn-icon" aria-label={`Call ${f.name}`} title={f.phone}>
                  <PhoneCall className="w-4 h-4" />
                </a>
              )}
              <button onClick={e => { e.stopPropagation(); openDirections(f); }} className="btn-icon" aria-label={`Directions to ${f.name}`}>
                <Navigation className="w-4 h-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {filter === 'shelter' && (
        <p className="text-[11px] text-white/55">
          Official relief camps are announced by your State Disaster Management Authority. Call <a href="tel:1070" className="text-amber-200 font-bold">1070</a> to find the nearest open camp.
        </p>
      )}
    </section>
  );
}

// ─────────────── Report form ───────────────
const CATEGORY_FOR = { flood: 'Flooding', fire: 'Fire', structural_damage: 'Building Collapse', landslide: 'Landslide', road_blocked: 'Road Blocked', electrical: 'Power Line Down' };

function ReportModal({ location, onClose }) {
  const [form, setForm] = useState({
    category: 'Flooding', location: location?.label || '', description: '', severity: 'HIGH', contactNumber: '',
  });
  const [attachCoords, setAttachCoords] = useState(!!location);
  const [image, setImage] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | sending | done
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const update = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const onImage = async (file) => {
    setImage(file || null);
    setAnalysis(null);
    if (!file) return;
    setAnalyzing(true);
    try {
      const a = await analyzePhoto(file, form.description);
      setAnalysis(a);
      if (a.success) {
        // pre-fill from the photo; the user can still change anything
        setForm(f => ({
          ...f,
          category: CATEGORY_FOR[a.hazardType] || f.category,
          severity: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(a.severity) ? a.severity : f.severity,
          description: f.description || a.summary,
        }));
      }
    } catch { setAnalysis(null); } finally { setAnalyzing(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setStatus('sending'); setError('');
    try {
      const coords = attachCoords && location ? { lat: location.lat, lng: location.lng } : {};
      setResult(await reports.submit({ ...form, ...coords }, image));
      setStatus('done');
    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  };

  return (
    <ModalPortal><div className="modal-backdrop z-[1500]" onClick={e => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-label="Report a disaster issue">
      <div className="glass-panel glass-modal p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" style={{ borderRadius: 'var(--r-xl)' }}>
        <button onClick={onClose} className="btn-icon absolute top-4 right-4" aria-label="Close"><X className="w-4 h-4" /></button>

        {status === 'done' ? (
          <div className="text-center py-4">
            <div className="service-icon-box mx-auto mb-3" style={{ background: 'rgba(52,211,153,0.2)', color: '#34D399' }}>
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-white">Report submitted</h3>
            <p className="text-sm text-white/70 mt-1">{result?.message}</p>
            {result?.report?.id && <p className="text-xs font-mono text-white/50 mt-2">Reference: {result.report.id.slice(0, 8).toUpperCase()}</p>}
            <button onClick={onClose} className="btn-primary mt-5 justify-center">Done</button>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-extrabold text-white mb-1 flex items-center gap-2"><Megaphone className="w-5 h-5 text-red-300" /> Report a problem</h3>
            <p className="text-xs text-white/60 mb-4">Reports are reviewed by the response team; you'll see status updates under Profile → My Reports. <b className="text-white">If anyone is in danger, call 112 first.</b></p>
            <form onSubmit={submit} className="space-y-3">
              <label className="block">
                <span className="block text-xs font-bold text-white/70 mb-1">Photo (optional, helps responders)</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => onImage(e.target.files[0])} className="text-xs text-white/70 file:mr-3 file:border-0 file:rounded-full file:px-3 file:py-1.5 file:bg-white/10 file:text-white" />
              </label>
              {analyzing && <p className="text-xs text-white/60 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analysing photo…</p>}
              {analysis?.success && (
                <div className="glass-well p-3 text-xs">
                  <p className="font-bold text-cyan-200 flex items-center gap-1.5"><ScanEye className="w-3.5 h-3.5" /> Photo looks like: <span className="capitalize">{analysis.hazardType.replace('_', ' ')}</span> ({analysis.confidence} confidence)</p>
                  <p className="text-white/70 mt-1">{analysis.summary}</p>
                  <p className="text-white/40 mt-1">We've pre-filled the form. Please check it.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-bold text-white/70 mb-1">Type</span>
                  <select value={form.category} onChange={update('category')} className="input-glass text-sm !py-2.5">
                    {['Flooding', 'Fire', 'Building Collapse', 'Landslide', 'Road Blocked', 'Power Line Down', 'Other'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-xs font-bold text-white/70 mb-1">Severity</span>
                  <select value={form.severity} onChange={update('severity')} className="input-glass text-sm !py-2.5">
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="block text-xs font-bold text-white/70 mb-1">Location</span>
                <input required minLength={3} value={form.location} onChange={update('location')} placeholder="Street, landmark, area" className="input-glass text-sm !py-2.5" />
              </label>
              {location && (
                <label className="flex items-center gap-2 text-xs text-white/70">
                  <input type="checkbox" checked={attachCoords} onChange={e => setAttachCoords(e.target.checked)} className="accent-amber-400" />
                  Attach my map position ({location.lat.toFixed(4)}, {location.lng.toFixed(4)})
                </label>
              )}
              <label className="block">
                <span className="block text-xs font-bold text-white/70 mb-1">What's happening?</span>
                <textarea required minLength={5} rows={3} value={form.description} onChange={update('description')} placeholder="Describe the situation" className="input-glass text-sm !rounded-2xl resize-none" />
              </label>
              <label className="block">
                <span className="block text-xs font-bold text-white/70 mb-1">Contact number (optional)</span>
                <input type="tel" value={form.contactNumber} onChange={update('contactNumber')} placeholder="+91" className="input-glass text-sm !py-2.5" />
              </label>
              <FormError message={error} />
              <button type="submit" disabled={status === 'sending' || analyzing} className="btn-emergency w-full justify-center !py-3 text-sm !animate-none">
                {status === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
                Submit report
              </button>
            </form>
          </>
        )}
      </div>
    </div></ModalPortal>
  );
}

// ─────────────── Page ───────────────
export default function EmergencyCenter() {
  const { location } = useLocationCtx();
  const { t } = useLanguage();
  const [showReport, setShowReport] = useState(false);

  return (
    <div className="space-y-5 fade-in max-w-4xl mx-auto pb-6">
      {/* Helplines first: they work with no location and no internet */}
      <section className="glass-panel p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-xl font-black text-white flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-red-300" /> {t.emergency}</h2>
          <button onClick={() => setShowReport(true)} className="btn-secondary !py-2 !px-3 text-xs">
            <Megaphone className="w-4 h-4 text-red-300" /> {t.report_problem}
          </button>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
          {HELPLINES.map(h => (
            <a key={h.number} href={`tel:${h.number}`} className={`glass-card p-2.5 text-center ${h.number === '112' ? 'col-span-3 sm:col-span-1 !bg-red-500/25' : ''}`}>
              <p className="text-lg font-black text-white font-display">{h.number}</p>
              <p className="text-[10px] text-white/60 leading-tight">{t[h.label]}</p>
            </a>
          ))}
        </div>
      </section>

      <LocationBar />

      {location ? (
        <>
          <ConditionsPanel location={location} />
          <NearbyHelp location={location} />
        </>
      ) : (
        <section className="glass-panel p-6 text-center text-sm text-white/65">
          Share your location or search for your town to see the weather, official alerts and the nearest hospitals, police and fire stations.
        </section>
      )}

      <a href="https://ndma.gov.in" target="_blank" rel="noreferrer" className="glass-card p-4 flex items-center justify-between gap-3">
        <span className="text-sm text-white/80">Disaster safety guides (NDMA)</span>
        <ExternalLink className="w-4 h-4 text-white/50" />
      </a>

      {showReport && <ReportModal location={location} onClose={() => setShowReport(false)} />}
    </div>
  );
}
