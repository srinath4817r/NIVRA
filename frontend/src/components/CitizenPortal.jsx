// frontend/src/components/CitizenPortal.jsx  — NIVRA Platform
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getGovernmentSchemes } from '../services/api';
import { ROUTES, trackState } from '../routes';
import useDebounce from '../hooks/useDebounce';
import { SaveButton } from '../context/SavedContext';
import { rememberItems } from '../lib/items';
import {
  Building2, Search, ExternalLink, ShieldCheck, FileText,
  ChevronRight, BookmarkPlus, GraduationCap, Landmark, Briefcase, HeartPulse,
  AlertTriangle, HelpCircle, Users, Sprout, Folder, SearchX
} from 'lucide-react';

// `to` navigates to another screen; `search` filters the schemes list on this screen
const SERVICES_GRID_ITEMS = [
  { search: '',          name: 'Government Schemes',   icon: Building2,     color: '#FF9933', bg: 'rgba(255,153,51,0.18)' },
  { to: ROUTES.scholarships, name: 'Student Scholarships', icon: GraduationCap, color: '#C29BFF', bg: 'rgba(169,112,255,0.2)' },
  { to: ROUTES.scholarships + '#loans', name: 'Education Loans', icon: Landmark, color: '#5FD4FF', bg: 'rgba(95,212,255,0.18)' },
  { to: ROUTES.documents, name: 'Certificates & Docs', icon: FileText,      color: '#7DD3FC', bg: 'rgba(125,211,252,0.18)' },
  { search: 'skill',     name: 'Job & Skill Dev',      icon: Briefcase,     color: '#FF5FA2', bg: 'rgba(255,95,162,0.18)' },
  { search: 'health',    name: 'Health & Insurance',   icon: HeartPulse,    color: '#FF4D63', bg: 'rgba(255,77,99,0.18)' },
  { to: ROUTES.emergency, name: 'Emergency Services',  icon: AlertTriangle, color: '#FF6B6B', bg: 'rgba(255,107,107,0.18)' },
  { to: ROUTES.emergency, name: 'Disaster Assistance', icon: ShieldCheck,   color: '#34D399', bg: 'rgba(52,211,153,0.18)' },
  { href: 'https://pgportal.gov.in', name: 'Grievance Complaints', icon: HelpCircle, color: '#FFB547', bg: 'rgba(255,181,71,0.18)' },
  { href: 'https://wcd.gov.in', name: 'Women & Child Support', icon: Users, color: '#F9A8D4', bg: 'rgba(249,168,212,0.18)' },
  { href: 'https://pmkisan.gov.in', name: 'Farmer Support', icon: Sprout, color: '#34D399', bg: 'rgba(52,211,153,0.18)' },
  { href: 'https://www.myscheme.gov.in', name: 'Other Services', icon: Folder, color: '#A3B1C6', bg: 'rgba(163,177,198,0.18)' },
];

const DOCUMENTS_LIST = [
  { name: 'Aadhaar Card', desc: 'Identity & Address Proof', cat: 'Personal', portal: 'https://uidai.gov.in' },
  { name: 'Income Certificate', desc: 'Required for fee reimbursement & government schemes', cat: 'Income', portal: 'https://serviceonline.gov.in' },
  { name: 'Caste Certificate', desc: 'For reservation benefits & SC/ST/OBC scholarships', cat: 'Personal', portal: 'https://serviceonline.gov.in' },
  { name: 'Domicile Certificate', desc: 'State residency proof for local quota', cat: 'Personal', portal: 'https://serviceonline.gov.in' },
  { name: 'Bonafide Certificate', desc: 'Issued by college/school for student verification', cat: 'Educational', portal: 'https://scholarships.gov.in' },
  { name: 'Disability Certificate', desc: 'For Divyangjan benefits & quota reservation', cat: 'Personal', portal: 'https://www.swavlambancard.gov.in' },
  { name: 'Ration Card', desc: 'Food security & PDS distribution eligibility', cat: 'Income', portal: 'https://nfsa.gov.in' },
];

function TileInner({ item }) {
  const Icon = item.icon;
  return (
    <>
      <div className="service-icon-box" style={{ background: item.bg, color: item.color }}>
        <Icon className="w-6 h-6" />
      </div>
      <span className="text-xs font-bold text-white leading-snug">{item.name}</span>
    </>
  );
}

function EmptyState({ text }) {
  return (
    <div className="glass-panel p-8 text-center text-white/60 text-sm flex flex-col items-center gap-2">
      <SearchX className="w-6 h-6 text-white/40" />
      {text}
    </div>
  );
}

function DocumentsGuide() {
  const [searchQuery, setSearchQuery] = useState('');
  const [docFilter, setDocFilter] = useState('All');

  const q = searchQuery.trim().toLowerCase();
  const filteredDocs = DOCUMENTS_LIST.filter(d =>
    (docFilter === 'All' || d.cat === docFilter) &&
    (!q || d.name.toLowerCase().includes(q) || d.desc.toLowerCase().includes(q))
  );

  return (
    <div className="space-y-5 fade-in max-w-4xl mx-auto">
      <section className="glass-panel p-5">
        <div className="flex items-center gap-3">
          <div className="service-icon-box" style={{ background: 'rgba(125,211,252,0.18)', color: '#7DD3FC' }}>
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">Documents Guide</h2>
            <p className="text-xs text-white/60">Official certificate procedures & verified portals</p>
          </div>
        </div>

        <div className="search-glow-wrapper mt-4">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/40 z-10 pointer-events-none" />
          <input
            type="search"
            placeholder="Search documents…"
            aria-label="Search documents"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-glass pl-11 py-2.5 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 mt-3 overflow-x-auto no-scrollbar">
          {['All', 'Personal', 'Educational', 'Income'].map(cat => (
            <button key={cat} onClick={() => setDocFilter(cat)} className={`chip ${docFilter === cat ? 'active' : ''}`}>
              {cat}
            </button>
          ))}
        </div>
      </section>

      <div className="space-y-3 stagger">
        {filteredDocs.map(doc => (
          <div key={doc.name} className="glass-card p-4 flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="service-icon-box !w-10 !h-10 !rounded-xl flex-shrink-0" style={{ background: 'rgba(125,211,252,0.15)', color: '#7DD3FC' }}>
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-white">{doc.name}</h3>
                <p className="text-xs text-white/60 mt-0.5">{doc.desc}</p>
              </div>
            </div>
            <a href={doc.portal} target="_blank" rel="noreferrer" className="btn-secondary !py-1.5 !px-3 text-xs flex-shrink-0">
              <span>Portal</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </a>
          </div>
        ))}
        {filteredDocs.length === 0 && <EmptyState text="No documents match your search." />}
      </div>
    </div>
  );
}

function ServicesHub() {
  const navigate = useNavigate();
  const [schemes, setSchemes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 250);
  const schemesRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getGovernmentSchemes(debouncedQuery).then(data => { if (!cancelled) { rememberItems(data); setSchemes(data); } });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const filterSchemes = (term) => {
    setSearchQuery(term);
    schemesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-5 fade-in max-w-4xl mx-auto">
      <section className="glass-panel p-5">
        <h2 className="text-2xl font-black text-white mb-1">Services</h2>
        <p className="text-xs text-white/60 mb-4">Discover national citizen & student services in one place</p>

        <div className="search-glow-wrapper">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/40 z-10 pointer-events-none" />
          <input
            type="search"
            placeholder="Search welfare schemes…"
            aria-label="Search welfare schemes"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-glass pl-11 py-2.5 text-xs"
          />
        </div>
      </section>

      <div className="grid-services-spec stagger">
        {SERVICES_GRID_ITEMS.map(item => {
          if (item.to) return <Link key={item.name} to={item.to} className="service-card-spec"><TileInner item={item} /></Link>;
          if (item.href) return <a key={item.name} href={item.href} target="_blank" rel="noreferrer" className="service-card-spec"><TileInner item={item} /></a>;
          return <button key={item.name} onClick={() => filterSchemes(item.search)} className="service-card-spec"><TileInner item={item} /></button>;
        })}
      </div>

      <section ref={schemesRef} className="space-y-3 pt-2 scroll-mt-24">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-base font-bold text-white">
            {searchQuery ? <>Schemes matching “{searchQuery}”</> : 'Popular Welfare Schemes'}
          </h3>
          {searchQuery && <button onClick={() => setSearchQuery('')} className="text-xs text-amber-300 font-semibold">Clear</button>}
        </div>
        <div className="grid-cards stagger">
          {schemes.map(sch => (
            <div key={sch.id} className="glass-card p-4 flex flex-col justify-between">
              <div>
                <span className="badge badge-green !text-[9px] mb-2">{sch.category}</span>
                <h4 className="font-extrabold text-white text-base mb-1">{sch.name}</h4>
                <p className="text-xs text-amber-200/90 font-semibold mb-2">{sch.ministry}</p>
                <p className="text-xs text-white/70 line-clamp-3">{sch.benefit}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                <a href={sch.officialLink} target="_blank" rel="noreferrer" className="btn-saffron !py-1.5 !px-3 text-xs">
                  <span>Official Portal</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <div className="flex gap-1.5">
                  <SaveButton itemId={sch.id} name={sch.name} />
                  <button
                    onClick={() => navigate(ROUTES.profile, { state: trackState(sch) })}
                    className="btn-icon"
                    title="Track application"
                    aria-label={`Track ${sch.name}`}
                  >
                    <BookmarkPlus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {schemes.length === 0 && <EmptyState text="No schemes match your search." />}
      </section>
    </div>
  );
}

export default function CitizenPortal({ viewMode = 'all-services' }) {
  return viewMode === 'documents' ? <DocumentsGuide /> : <ServicesHub />;
}
