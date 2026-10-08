// frontend/src/components/LogoutConfirmModal.jsx — Liquid Glass Logout Confirmation Dialog
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, X } from 'lucide-react';
import ModalPortal from './ModalPortal';

export default function LogoutConfirmModal() {
  const { showLogoutConfirm, setShowLogoutConfirm, logout } = useAuth();

  if (!showLogoutConfirm) return null;

  return (
    <ModalPortal><div
      className="modal-backdrop z-[9999]"
      onClick={e => { if (e.target === e.currentTarget) setShowLogoutConfirm(false); }}
      role="alertdialog"
      aria-modal="true"
      aria-label="Log out"
    >
      <div className="glass-panel glass-modal w-full max-w-sm p-6 text-center" style={{ borderRadius: 'var(--r-xl)' }}>
        <button onClick={() => setShowLogoutConfirm(false)} className="btn-icon absolute top-4 right-4" aria-label="Close">
          <X className="w-4 h-4" />
        </button>

        <div className="service-icon-box !w-14 !h-14 mx-auto mb-4" style={{ background: 'rgba(255,77,99,0.18)', color: '#FF4D63' }}>
          <LogOut className="w-7 h-7" />
        </div>

        <h3 className="font-display font-extrabold text-white text-lg mb-1">Log out of NIVRA?</h3>
        <p className="text-xs text-white/60 mb-6 px-2 leading-relaxed">
          You'll need to sign in again to access saved schemes and AI services.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setShowLogoutConfirm(false)} className="btn-secondary justify-center text-xs">Cancel</button>
          <button onClick={logout} className="btn-emergency !animate-none justify-center text-xs">Yes, log out</button>
        </div>
      </div>
    </div></ModalPortal>
  );
}
