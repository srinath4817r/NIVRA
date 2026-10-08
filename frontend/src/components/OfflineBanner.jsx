// frontend/src/components/OfflineBanner.jsx — tells people they're offline and what still works
import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export default function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  if (online) return null;
  return (
    <div role="status" className="mx-2 sm:mx-4 mt-2 rounded-2xl border border-amber-300/40 bg-amber-400/15 px-4 py-2.5 text-xs text-amber-50 flex items-center gap-2">
      <WifiOff className="w-4 h-4 flex-shrink-0" />
      <span>You're offline. Showing saved information. Calls still work: <a href="tel:112" className="font-black underline">112</a> · <a href="tel:108" className="font-black underline">108</a> · <a href="tel:1070" className="font-black underline">1070</a></span>
    </div>
  );
}
