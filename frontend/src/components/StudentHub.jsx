// frontend/src/components/StudentHub.jsx  — NIVRA Platform
import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { getScholarships, getScholarshipById, getEducationLoans } from '../services/api';
import { ROUTES, trackState } from '../routes';
import useDebounce from '../hooks/useDebounce';
import { SaveButton } from '../context/SavedContext';
import { deadlineText, rememberItems } from '../lib/items';
import {
  GraduationCap, Award, Landmark, Search, ExternalLink, BookmarkPlus,
  ChevronRight, ChevronLeft, CheckCircle2, CalendarClock, SearchX, Loader2
} from 'lucide-react';

const FILTERS = ['All', 'Engineering', 'UG', 'PG', 'Girls', 'School'];

function ScholarshipDetail({ id }) {
  const navigate = useNavigate();
  const [scheme, setScheme] = useState(undefined); // undefined = loading, null = not found

  useEffect(() => {
    let cancelled = false;
    getScholarshipById(id).then(data => { if (!cancelled) { rememberItems(data ? [data] : []); setScheme(data); } });
    return () => { cancelled = true; };
  }, [id]);

  if (scheme === undefined) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-amber-300" /></div>;
  }

  if (scheme === null) {
    return (
      <div className="max-w-md mx-auto glass-panel p-8 text-center fade-in">
        <h2 className="text-xl font-black text-white">Scholarship not found</h2>
        <Link to={ROUTES.scholarships} className="btn-primary mt-5 justify-center">Browse scholarships</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 fade-in max-w-4xl mx-auto">
      <Link to={ROUTES.scholarships} className="btn-secondary !py-1.5 !px-3 text-xs">
        <ChevronLeft className="w-4 h-4" /> Scholarships
      </Link>

      <section className="glass-panel p-5 sm:p-7">
        <span className="badge badge-purple mb-3">{scheme.category}</span>
        <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">{scheme.name}</h2>
        <p className="text-sm text-amber-200/90 font-semibold mt-1">{scheme.offeredBy}</p>
        {scheme.description && <p className="text-sm text-white/70 mt-3">{scheme.description}</p>}
        {scheme.sourceNote && <p className="text-[11px] text-white/45 mt-2">{scheme.sourceNote}</p>}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
          <div className="glass-well p-3">
            <span className="eyebrow">Amount</span>
            <p className="text-sm font-black text-emerald-300 mt-0.5">{scheme.amount}</p>
          </div>
          <div className="glass-well p-3">
            <span className="eyebrow">Level</span>
            <p className="text-xs font-bold text-white mt-0.5">{scheme.level}</p>
          </div>
          <div className="glass-well p-3 col-span-2 sm:col-span-1">
            <span className="eyebrow">When to apply</span>
            <p className="text-xs font-bold text-amber-200 mt-0.5">{deadlineText(scheme) || scheme.applicationWindow || 'Check the official portal'}</p>
          </div>
        </div>

        <div className="mt-6 grid sm:grid-cols-2 gap-5">
          <div>
            <h4 className="eyebrow mb-2">Eligibility</h4>
            <ul className="space-y-2 text-sm text-white/80">
              {scheme.eligibility.map((el, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span>{el}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="eyebrow mb-2">Documents</h4>
            <ul className="space-y-2 text-sm text-white/80">
              {scheme.documents.map((d, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-300 mt-2 flex-shrink-0" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-7 flex flex-col sm:flex-row gap-3">
          <a href={scheme.officialLink} target="_blank" rel="noreferrer" className="btn-primary justify-center py-3 px-6">
            <span>Apply on Official Portal</span>
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            onClick={() => navigate(ROUTES.profile, { state: trackState(scheme) })}
            className="btn-secondary justify-center py-3 px-6"
          >
            <BookmarkPlus className="w-4 h-4" />
            <span>Track Application</span>
          </button>
          <SaveButton itemId={scheme.id} name={scheme.name} className="self-center !p-3" />
        </div>
      </section>
    </div>
  );
}

function ScholarshipFinder() {
  const { hash } = useLocation();
  const [scholarships, setScholarships] = useState(null);
  const [loans, setLoans] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState('All');
  const debouncedQuery = useDebounce(searchQuery, 250);

  useEffect(() => {
    let cancelled = false;
    getScholarships(filterTag.toLowerCase(), debouncedQuery).then(data => { if (!cancelled) { rememberItems(data); setScholarships(data); } });
    return () => { cancelled = true; };
  }, [debouncedQuery, filterTag]);

  useEffect(() => {
    getEducationLoans().then(setLoans);
  }, []);

  // Deep link: /scholarships#loans
  useEffect(() => {
    if (hash === '#loans' && loans.length) {
      document.getElementById('loans')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [hash, loans.length]);

  return (
    <div className="space-y-5 fade-in max-w-4xl mx-auto">
      <section className="glass-panel p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="service-icon-box" style={{ background: 'rgba(169,112,255,0.2)', color: '#C29BFF' }}>
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">Scholarship Finder</h2>
            <p className="text-xs text-white/60">Verified government & merit scholarships for Indian students</p>
          </div>
        </div>

        <div className="search-glow-wrapper">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/40 z-10 pointer-events-none" />
          <input
            type="search"
            placeholder="Search scholarships…"
            aria-label="Search scholarships"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-glass pl-11 py-2.5 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 mt-3 overflow-x-auto no-scrollbar">
          {FILTERS.map(tag => (
            <button key={tag} onClick={() => setFilterTag(tag)} className={`chip ${filterTag === tag ? 'active' : ''}`}>
              {tag}
            </button>
          ))}
        </div>
      </section>

      <div className="space-y-3 stagger">
        {scholarships === null && (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-amber-300" /></div>
        )}
        {scholarships?.map(sch => (
          <Link
            key={sch.id}
            to={ROUTES.scholarship(sch.id)}
            className="glass-card p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3">
              <div className="service-icon-box flex-shrink-0" style={{ background: 'rgba(255,181,71,0.18)', color: '#FFB547' }}>
                <Award className="w-6 h-6" />
              </div>
              <div>
                <span className="badge badge-purple !text-[9px] mb-1">{sch.category}</span>
                <h3 className="font-extrabold text-white text-base leading-tight">{sch.name}</h3>
                <p className="text-xs text-white/60 mt-0.5">{sch.offeredBy}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-xs font-black text-emerald-300">{sch.amount}</span>
                  {sch.applicationWindow && (
                    <span className="text-[11px] text-amber-200/90 font-semibold flex items-center gap-1">
                      <CalendarClock className="w-3 h-3 flex-shrink-0" /> {deadlineText(sch) || sch.applicationWindow}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <span className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
              <SaveButton itemId={sch.id} name={sch.name} />
              <span className="text-xs text-white/80 font-bold flex items-center gap-1">Details <ChevronRight className="w-4 h-4" /></span>
            </span>
          </Link>
        ))}
        {scholarships?.length === 0 && (
          <div className="glass-panel p-8 text-center text-white/60 text-sm flex flex-col items-center gap-2">
            <SearchX className="w-6 h-6 text-white/40" /> No scholarships match these filters.
          </div>
        )}
      </div>

      <section id="loans" className="glass-panel p-5 mt-6 scroll-mt-24">
        <h3 className="text-lg font-black text-white mb-1 flex items-center gap-2">
          <Landmark className="w-5 h-5 text-cyan-300" /> Collateral-Free Education Loans
        </h3>
        <p className="text-xs text-white/60 mb-4">Under Vidya Lakshmi guidelines, loans up to ₹7.5 Lakhs need no third-party guarantee.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {loans.map(loan => (
            <div key={loan.id} className="glass-card p-4 flex flex-col">
              <span className="badge badge-blue !text-[9px] mb-2 self-start">{loan.offeredBy}</span>
              <h4 className="font-bold text-white text-sm">{loan.schemeName}</h4>
              <p className="text-xs text-emerald-300 font-bold mt-1">{loan.maxLoanAmount}</p>
              <p className="text-[11px] text-white/60">{loan.interestRate}</p>
              <a href={loan.officialSource} target="_blank" rel="noreferrer" className="btn-saffron !py-1.5 !px-3 text-xs mt-3 self-start">
                <span>Apply Portal</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function StudentHub() {
  const { id } = useParams();
  return id ? <ScholarshipDetail id={id} /> : <ScholarshipFinder />;
}
