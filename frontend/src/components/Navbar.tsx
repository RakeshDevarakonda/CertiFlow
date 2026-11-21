import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { switchPersona, logout } from '../store/authSlice';
import { DEMO_PERSONAS } from '../types';
import type { DemoPersona } from '../types';
import { ShieldCheck, UserCheck, RefreshCw, LogOut } from 'lucide-react';
import { api } from '../services/api';

export const Navbar: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { activePersona, user, loading } = useSelector((state: RootState) => state.auth);
  const [processingOutbox, setProcessingOutbox] = React.useState(false);

  const handleProcessOutbox = async () => {
    try {
      setProcessingOutbox(true);
      await api.post('/outbox/process', { batchSize: 50 });
      window.dispatchEvent(new CustomEvent('outbox-processed'));
    } catch (e) {
      console.error(e);
    } finally {
      setProcessingOutbox(false);
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-blue-700 flex items-center justify-center font-bold text-white shadow-sm">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900">CertiFlow</span>
              <span className="text-xs block text-slate-500 font-medium">Pragati Skills Mission • Government of Maharashtra</span>
            </div>
          </div>

          {/* User Info & Outbox & Sign Out */}
          <div className="flex items-center space-x-3">
            {user && (
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-slate-800">{user.fullName}</div>
                <div className="text-[10px] text-slate-500">{user.role} {user.district ? `(${user.district})` : ''}</div>
              </div>
            )}

            <button
              onClick={handleProcessOutbox}
              disabled={processingOutbox}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 border border-slate-300 transition"
              title="Process background outbox validation & WhatsApp dispatch"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${processingOutbox ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              <span>{processingOutbox ? 'Syncing...' : 'Sync Outbox'}</span>
            </button>

            <button
              onClick={() => dispatch(logout())}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition"
              title="Sign out of current account"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Quick Switcher Bar */}
        <div className="py-2 border-t border-slate-100 flex items-center space-x-2 overflow-x-auto text-xs">
          <div className="flex items-center text-slate-500 mr-1 flex-shrink-0">
            <UserCheck className="w-3.5 h-3.5 mr-1 text-slate-600" />
            <span className="font-semibold text-[11px]">Quick Switcher:</span>
          </div>
          <div className="flex space-x-1.5">
            {DEMO_PERSONAS.map((p: DemoPersona) => {
              const isActive = activePersona?.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => dispatch(switchPersona(p))}
                  disabled={loading}
                  className={`px-2.5 py-1 rounded-full font-medium transition flex items-center space-x-1.5 flex-shrink-0 text-xs ${
                    isActive
                      ? 'bg-blue-700 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-300' : 'bg-slate-400'}`} />
                  <span>{p.name}</span>
                  <span className="text-[10px] opacity-80">({p.avatarBadge})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
};
