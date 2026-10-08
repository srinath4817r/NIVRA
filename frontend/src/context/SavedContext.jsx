// frontend/src/context/SavedContext.jsx — the signed-in user's bookmarked scholarships/schemes
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { saved as savedApi } from '../services/userApi';

const SavedContext = createContext({ ids: new Set(), toggle: async () => {} });

export const SavedProvider = ({ children }) => {
  const [ids, setIds] = useState(new Set());

  useEffect(() => {
    savedApi.list().then(r => setIds(new Set(r.ids))).catch(() => {});
  }, []);

  const toggle = useCallback(async (itemId) => {
    const wasSaved = ids.has(itemId);
    const flip = (on) => setIds(prev => {
      const next = new Set(prev);
      if (on) next.add(itemId); else next.delete(itemId);
      return next;
    });
    flip(!wasSaved);   // optimistic
    try {
      await (wasSaved ? savedApi.remove(itemId) : savedApi.add(itemId));
    } catch {
      flip(wasSaved);  // roll back
    }
  }, [ids]);

  return <SavedContext.Provider value={{ ids, toggle }}>{children}</SavedContext.Provider>;
};

export const useSaved = () => useContext(SavedContext);

export function SaveButton({ itemId, name, className = '' }) {
  const { ids, toggle } = useSaved();
  const isSaved = ids.has(itemId);
  const Icon = isSaved ? BookmarkCheck : Bookmark;
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(itemId); }}
      className={`btn-icon ${isSaved ? '!text-amber-300 !border-amber-300/40' : ''} ${className}`}
      aria-pressed={isSaved}
      aria-label={isSaved ? `Remove ${name} from saved` : `Save ${name}`}
      title={isSaved ? 'Saved' : 'Save for later'}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
