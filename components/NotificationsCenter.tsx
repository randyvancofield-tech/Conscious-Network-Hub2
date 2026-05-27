import React from 'react';
import { Bell, ChevronRight, ShieldCheck } from 'lucide-react';

interface NotificationsCenterProps {
  onBack: () => void;
}

const NotificationsCenter: React.FC<NotificationsCenterProps> = ({ onBack }) => {
  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-sm font-bold"
      >
        <ChevronRight className="w-4 h-4 rotate-180" /> Back to Hub
      </button>

      <div className="glass-panel rounded-[2rem] p-6 sm:p-8 border border-white/10 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-blue-600/15 border border-blue-500/20">
            <Bell className="w-5 h-5 text-blue-300" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Notifications Center</h2>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-black mt-1">Security, Social, and Session Updates</p>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.04] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 h-5 w-5 text-amber-200" />
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-white">Notifications Locked For Backend Completion</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Static sample notifications have been removed. This center will show only authenticated, user-specific backend notifications after Phase 5.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationsCenter;
