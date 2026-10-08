// frontend/src/components/FacilityMap.jsx — Leaflet + OpenStreetMap tiles
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export const TYPE_STYLE = {
  hospital: { color: '#34D399', emoji: '🏥' },
  police:   { color: '#5FD4FF', emoji: '🚓' },
  fire:     { color: '#FFB547', emoji: '🚒' },
  pharmacy: { color: '#F9A8D4', emoji: '💊' },
  shelter:  { color: '#C29BFF', emoji: '⛺' },
};

// divIcons avoid Leaflet's default marker images (which break under bundlers)
const pin = (type, active) => L.divIcon({
  className: '',
  html: `<div class="map-pin${active ? ' active' : ''}" style="--pin:${TYPE_STYLE[type]?.color || '#FF4D63'}"><span>${TYPE_STYLE[type]?.emoji || '📍'}</span></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -30],
});

const youIcon = L.divIcon({ className: '', html: '<div class="map-you"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default function FacilityMap({ center, facilities, selectedId, onSelect }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const markers = useRef(new Map());

  // create once
  useEffect(() => {
    map.current = L.map(el.current, { zoomControl: true, attributionControl: true }).setView([center.lat, center.lng], 14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => { map.current.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // recentre when the location changes
  useEffect(() => {
    map.current?.setView([center.lat, center.lng], 14);
  }, [center.lat, center.lng]);

  // redraw markers
  useEffect(() => {
    if (!layer.current) return;
    layer.current.clearLayers();
    markers.current.clear();
    L.marker([center.lat, center.lng], { icon: youIcon, title: 'You' }).addTo(layer.current);
    for (const f of facilities) {
      const m = L.marker([f.lat, f.lng], { icon: pin(f.type, f.id === selectedId), title: f.name })
        .bindPopup(`<b>${esc(f.name)}</b><br>${esc(f.typeLabel)} · ${f.distanceKm} km${f.phone ? `<br><a href="tel:${esc(f.phone)}">${esc(f.phone)}</a>` : ''}`)
        .on('click', () => onSelect?.(f.id));
      m.addTo(layer.current);
      markers.current.set(f.id, m);
    }
  }, [facilities, center.lat, center.lng, selectedId, onSelect]);

  // open the selected facility's popup
  useEffect(() => {
    const m = selectedId && markers.current.get(selectedId);
    if (m) {
      map.current.panTo(m.getLatLng());
      m.openPopup();
    }
  }, [selectedId]);

  return <div ref={el} className="w-full h-72 sm:h-80 rounded-2xl overflow-hidden border border-white/10 relative z-0 isolate" role="region" aria-label="Map of nearby facilities" />;
}
