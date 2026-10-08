// frontend/src/context/LocationContext.jsx — where the user is (GPS or a chosen city)
// Location is only requested when the user asks; the last one is remembered on this device.
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getJSON } from '../services/http';

const LocationContext = createContext();
const STORAGE_KEY = 'nivra_location_v1';

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; } catch { return null; }
}

export const LocationProvider = ({ children }) => {
  const saved = loadSaved();
  const [location, setLocation] = useState(saved);   // { lat, lng, label, state, source }
  const [status, setStatus] = useState(saved ? 'ready' : 'idle'); // idle | locating | ready | denied | error
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      if (location) localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
    } catch { /* storage unavailable */ }
  }, [location]);

  const locateMe = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('error');
      setError("This device can't share its location. Search for your city instead.");
      return;
    }
    setStatus('locating');
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        let place = null;
        try { place = await getJSON('/geo/place', { lat, lng }); } catch { /* name is optional */ }
        setLocation({
          lat, lng,
          label: place?.city ? `${place.city}${place.state ? `, ${place.state}` : ''}` : 'Your location',
          state: place?.state || null,
          source: 'gps',
          accuracyM: Math.round(pos.coords.accuracy),
        });
        setStatus('ready');
      },
      (err) => {
        setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error');
        setError(err.code === err.PERMISSION_DENIED
          ? 'Location permission was denied. Search for your city instead, or allow location in your browser settings.'
          : "Couldn't get your location. Search for your city instead.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  const choosePlace = useCallback((p) => {
    setLocation({ lat: p.lat, lng: p.lng, label: [p.name, p.state].filter(Boolean).join(', '), state: p.state || null, source: 'search' });
    setStatus('ready');
    setError('');
  }, []);

  return (
    <LocationContext.Provider value={{ location, status, error, locateMe, choosePlace }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocationCtx = () => useContext(LocationContext);
