import React from 'react';
import { Bell, ChevronRight, ShieldCheck, MessageSquare, Calendar, Users } from 'lucide-react';

interface NotificationsCenterProps {
  onBack: () => void;
}

const notifications = [
  {
    id: 'n-1',
    title: 'Identity Security Updated',
    detail: 'Your verification record was refreshed and anchored successfully.',
    icon: <ShieldCheck className="w-4 h-4 text-teal-400" />,
    at: 'Just now',
  },
  {
    id: 'n-2',
    title: 'New Social Linkage',
    detail: 'A member responded to one of your social learning posts.',
    icon: <MessageSquare className="w-4 h-4 text-blue-400" />,
    at: '12m ago',
  },
  {
    id: 'n-3',
    title: 'Session Reminder',
    detail: 'Upcoming conscious meeting starts in 2 hours.',
    icon: <Calendar className="w-4 h-4 text-orange-400" />,
    at: '1h ago',
  },
  {
    id: 'n-4',
    title: 'Network Directory Updated',
    detail: 'New members joined your active learning cohort.',
    icon: <Users className="w-4 h-4 text-indigo-400" />,
    at: 'Yesterday',
  },
];

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

        <div className="space-y-3">
          {notifications.map((item) => (
            <div key={item.id} className="p-4 sm:p-5 bg-white/5 border border-white/10 rounded-2xl">
              <div className="flex items-start gap-3">
                <div className="mt-1">{item.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-sm sm:text-base text-white font-bold">{item.title}</h4>
                    <span className="text-[9px] uppercase tracking-widest text-slate-500 font-black shrink-0">{item.at}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">{item.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NotificationsCenter;
