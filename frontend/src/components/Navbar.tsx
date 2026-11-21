import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { switchPersona, logout } from '../store/authSlice';
import { DEMO_PERSONAS } from '../types';
import type { DemoPersona } from '../types';
import { ShieldCheck, UserCheck, LogOut, Award } from 'lucide-react';

interface Props {
  currentTab: 'portal' | 'registry';
  onTabChange: (tab: 'portal' | 'registry') => void;
}

export const Navbar: React.FC<Props> = ({ currentTab, onTabChange }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { activePersona, user, loading } = useSelector((state: RootState) => state.auth);

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

          {/* Navigation Tabs (Workspace vs Certificate Registry) */}
          <div className="hidden md:flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => onTabChange('portal')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                currentTab === 'portal'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Role Workspace
            </button>
            <button
              onClick={() => onTabChange('registry')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center space-x-1 ${
                currentTab === 'registry'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-blue-600" />
              <span>Certificates Registry</span>
            </button>
          </div>

          {/* User Info & Sign Out */}
          <div className="flex items-center space-x-3">
            {user && (
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-slate-800">{user.fullName}</div>
                <div className="text-[10px] text-slate-500">{user.role} {user.district ? `(${user.district})` : ''}</div>
              </div>
            )}

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

        {/* Quick Switcher Bar & Mobile Registry Button */}
        <div className="py-2 border-t border-slate-100 flex items-center justify-between text-xs overflow-x-auto">
          <div className="flex items-center space-x-2">
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
                    onClick={() => {
                      onTabChange('portal');
                      dispatch(switchPersona(p));
                    }}
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

          <div className="md:hidden flex-shrink-0 pl-2">
            <button
              onClick={() => onTabChange(currentTab === 'portal' ? 'registry' : 'portal')}
              className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-semibold text-xs border border-blue-200 flex items-center space-x-1"
            >
              <Award className="w-3 h-3" />
              <span>{currentTab === 'portal' ? 'View Registry' : 'Back to Workspace'}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
