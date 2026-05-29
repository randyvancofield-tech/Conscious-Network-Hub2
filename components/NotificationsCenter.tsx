import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Check, ChevronRight, ShieldCheck } from 'lucide-react';
import { ApiError, api } from '../services/apiClient';

interface NotificationsCenterProps {
  onBack: () => void;
}

interface PlatformNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

const formatNotificationTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const NotificationsCenter: React.FC<NotificationsCenterProps> = ({ onBack }) => {
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications]
  );

  const loadNotifications = async (): Promise<void> => {
    setLoading(true);
    setError('');
    try {
      const data = await api<{ notifications: PlatformNotification[] }>('/notifications', {
        method: 'GET',
      });
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Sign in to view notifications.');
      } else {
        setError(err instanceof Error ? err.message : 'Unable to load notifications.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, []);

  const markRead = async (id: string): Promise<void> => {
    try {
      const data = await api<{ notification: PlatformNotification }>(
        `/notifications/${encodeURIComponent(id)}/read`,
        { method: 'PATCH' }
      );
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === id ? data.notification || notification : notification
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update notification.');
    }
  };

  const markAllRead = async (): Promise<void> => {
    try {
      await api('/notifications/read-all', { method: 'PATCH' });
      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          readAt: notification.readAt || readAt,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update notifications.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-sm font-bold"
      >
        <ChevronRight className="w-4 h-4 rotate-180" /> Back to Hub
      </button>

      <div className="glass-panel rounded-[2rem] p-6 sm:p-8 border border-white/10 shadow-2xl">
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-600/15 border border-blue-500/20">
              <Bell className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Notifications Center</h2>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-black mt-1">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-200 transition-colors hover:bg-white/10"
            >
              <Check className="h-4 w-4" /> Mark All Read
            </button>
          )}
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {loading && <p className="text-sm text-slate-400">Loading notifications...</p>}

        {!loading && notifications.length === 0 && (
          <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.04] p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 h-5 w-5 text-amber-200" />
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-white">No Notifications</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Account, provider, membership, and security updates will appear here.
                </p>
              </div>
            </div>
          </div>
        )}

        {!loading && notifications.length > 0 && (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`rounded-2xl border p-4 sm:p-5 ${
                  notification.readAt
                    ? 'border-white/10 bg-white/[0.03]'
                    : 'border-blue-300/30 bg-blue-500/10'
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-black text-white">{notification.title}</h3>
                      {!notification.readAt && (
                        <span className="rounded-full bg-blue-400/20 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-blue-100">
                          New
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{notification.body}</p>
                    <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      {formatNotificationTime(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.readAt && (
                    <button
                      onClick={() => markRead(notification.id)}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-200 transition-colors hover:bg-white/10"
                    >
                      <Check className="h-4 w-4" /> Read
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsCenter;
