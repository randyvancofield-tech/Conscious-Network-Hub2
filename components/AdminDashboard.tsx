import React, { useEffect, useMemo, useState } from 'react';
import { KeyRound, LockKeyhole, RefreshCw, ShieldCheck, Trash2, UnlockKeyhole, Users } from 'lucide-react';
import { api, ApiError } from '../services/apiClient';
import { getAdminElevationToken, getCachedAuthUser, setAdminElevationToken } from '../services/sessionService';
import { ActionButton, EmptyState, PageHeader, PageShell, SurfacePanel } from './ui/PlatformPrimitives';

type AdminRole = 'user' | 'applicant' | 'provider' | 'admin';

interface AdminUserSummary {
  id: string;
  email: string;
  name: string | null;
  role: AdminRole;
  tier: string | null;
  subscriptionStatus: string | null;
  providerApproved: boolean;
  providerApprovalStatus: string | null;
  twoFactorMethod: string;
  lockoutUntil: string | null;
  locked?: boolean;
  createdAt: string;
}

interface AdminDashboardPayload {
  summary: {
    usersTotal: number;
    roleCounts: Record<AdminRole, number>;
    activeMemberships: number;
    providerApproved: number;
  };
  recentUsers: AdminUserSummary[];
}

const adminHeaders = (): HeadersInit => {
  const token = getAdminElevationToken();
  return token ? { 'X-Admin-Elevation-Token': token } : {};
};

const isUserLocked = (user: AdminUserSummary): boolean => {
  if (user.locked === true) return true;
  if (!user.lockoutUntil) return false;
  const lockedUntil = new Date(user.lockoutUntil);
  return Number.isFinite(lockedUntil.getTime()) && lockedUntil.getTime() > Date.now();
};

const AdminDashboard: React.FC = () => {
  const [password, setPassword] = useState('');
  const [elevationCode, setElevationCode] = useState('');
  const [dashboard, setDashboard] = useState<AdminDashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [elevating, setElevating] = useState(false);
  const [error, setError] = useState('');
  const [roleChangeUserId, setRoleChangeUserId] = useState<string | null>(null);
  const [accountActionUserId, setAccountActionUserId] = useState<string | null>(null);
  const [deleteConfirmUserId, setDeleteConfirmUserId] = useState<string | null>(null);

  const isElevated = useMemo(() => Boolean(getAdminElevationToken()), [dashboard, error]);
  const currentAdminId = getCachedAuthUser()?.id || null;

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<AdminDashboardPayload>('/admin/dashboard', {
        headers: adminHeaders(),
      });
      setDashboard(data);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setAdminElevationToken('');
        setDashboard(null);
        setError('Admin elevation is required to open the console.');
        return;
      }
      setError(error instanceof Error ? error.message : 'Unable to load admin dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (getAdminElevationToken()) {
      void loadDashboard();
    }
  }, []);

  const elevate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password.trim() && !elevationCode.trim()) {
      setError('Enter an admin password or operations elevation code.');
      return;
    }
    setElevating(true);
    setError('');
    try {
      const data = await api<{ elevationToken: string }>('/admin/elevate', {
        method: 'POST',
        body: { password, elevationCode },
      });
      setAdminElevationToken(data.elevationToken);
      setPassword('');
      setElevationCode('');
      await loadDashboard();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to elevate admin session.');
    } finally {
      setElevating(false);
    }
  };

  const lockUser = async (userId: string) => {
    setAccountActionUserId(userId);
    setDeleteConfirmUserId(null);
    setError('');
    try {
      await api(`/admin/users/${encodeURIComponent(userId)}/lock`, {
        method: 'POST',
        headers: adminHeaders(),
        body: { reason: 'Admin console profile lock' },
      });
      await loadDashboard();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to lock user profile.');
    } finally {
      setAccountActionUserId(null);
    }
  };

  const unlockUser = async (userId: string) => {
    setAccountActionUserId(userId);
    setDeleteConfirmUserId(null);
    setError('');
    try {
      await api(`/admin/users/${encodeURIComponent(userId)}/unlock`, {
        method: 'POST',
        headers: adminHeaders(),
        body: { reason: 'Admin console profile unlock' },
      });
      await loadDashboard();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to unlock user profile.');
    } finally {
      setAccountActionUserId(null);
    }
  };

  const deleteUser = async (userId: string) => {
    if (deleteConfirmUserId !== userId) {
      setDeleteConfirmUserId(userId);
      setError('');
      return;
    }

    setAccountActionUserId(userId);
    setError('');
    try {
      await api(`/admin/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: adminHeaders(),
        body: {
          confirm: 'DELETE USER',
          reason: 'Admin console account removal',
        },
      });
      setDeleteConfirmUserId(null);
      await loadDashboard();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to delete user profile.');
    } finally {
      setAccountActionUserId(null);
    }
  };

  const updateRole = async (userId: string, role: AdminRole) => {
    setRoleChangeUserId(userId);
    setError('');
    try {
      await api(`/admin/users/${encodeURIComponent(userId)}/role`, {
        method: 'PATCH',
        headers: adminHeaders(),
        body: {
          role,
          reason:
            role === 'provider'
              ? 'Admin dashboard role management. Provider role assignment does not approve provider access; applicant approval is still required.'
              : 'Admin dashboard role management',
        },
      });
      await loadDashboard();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to update role.');
    } finally {
      setRoleChangeUserId(null);
    }
  };

  if (!isElevated || !dashboard) {
    return (
      <PageShell>
        <PageHeader
          eyebrow="Superuser Access"
          title="Admin Console"
          description="Administrative visibility requires a short-lived elevation token before platform-wide data is shown."
        />
        <SurfacePanel className="max-w-xl">
          <form onSubmit={elevate} className="space-y-5">
            <div className="flex items-center gap-3 text-blue-200">
              <KeyRound className="h-5 w-5" />
              <span className="text-xs font-black uppercase">Elevated Authentication</span>
            </div>
            {error && <p className="text-sm text-amber-200">{error}</p>}
            <label className="block space-y-2">
              <span className="text-xs font-black uppercase text-slate-500">Admin password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-black uppercase text-slate-500">Elevation code</span>
              <input
                type="password"
                value={elevationCode}
                onChange={(event) => setElevationCode(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </label>
            <ActionButton type="submit" disabled={elevating} icon={<ShieldCheck className="h-4 w-4" />}>
              {elevating ? 'Verifying' : 'Elevate Session'}
            </ActionButton>
          </form>
        </SurfacePanel>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Superuser Access"
        title="Admin Console"
        description="Full platform visibility for user roles, memberships, provider approval state, and governance checks."
        actions={
          <ActionButton type="button" variant="secondary" onClick={loadDashboard} icon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </ActionButton>
        }
      />

      {error && <EmptyState title="Admin action failed" description={error} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ['Users', dashboard.summary.usersTotal],
          ['Members', dashboard.summary.roleCounts.user],
          ['Applicants', dashboard.summary.roleCounts.applicant],
          ['Providers', dashboard.summary.roleCounts.provider],
          ['Admins', dashboard.summary.roleCounts.admin],
        ].map(([label, value]) => (
          <SurfacePanel key={label} className="space-y-2">
            <p className="text-xs font-black uppercase text-slate-500">{label}</p>
            <p className="text-3xl font-black text-white">{value}</p>
          </SurfacePanel>
        ))}
      </div>

      <SurfacePanel className="overflow-hidden">
        <div className="mb-5 flex items-center gap-3">
          <Users className="h-5 w-5 text-blue-300" />
          <h2 className="text-sm font-black uppercase text-white">Platform Users</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-3 pr-4">Identity</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Role</th>
                <th className="py-3 pr-4">Tier</th>
                <th className="py-3 pr-4">Provider Approval</th>
                <th className="py-3 pr-4">2FA</th>
                <th className="py-3 pr-4">Role Change</th>
                <th className="py-3 pr-4">Profile Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {dashboard.recentUsers.map((user) => {
                const locked = isUserLocked(user);
                const protectedProfile = user.role === 'admin' || user.id === currentAdminId;
                const actionBusy = accountActionUserId === user.id;
                return (
                  <tr key={user.id}>
                    <td className="py-4 pr-4">
                      <p className="cnh-person-name font-bold text-white">{user.name || user.email}</p>
                      <p className="break-words text-xs text-slate-500">{user.email}</p>
                    </td>
                    <td className="py-4 pr-4">
                      <span
                        className={`cnh-status-badge inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                          locked
                            ? 'border-amber-300/30 bg-amber-300/10 text-amber-100'
                            : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                        }`}
                      >
                        {locked ? 'Locked' : 'Active'}
                      </span>
                    </td>
                    <td className="py-4 pr-4 text-slate-200">{user.role}</td>
                    <td className="py-4 pr-4 text-slate-400">{user.tier || 'None'}</td>
                    <td className="py-4 pr-4">
                      <span
                        className={`cnh-status-badge inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                          user.providerApproved
                            ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100'
                            : 'border-white/10 bg-white/5 text-slate-400'
                        }`}
                      >
                        {user.providerApproved ? 'Approved' : user.providerApprovalStatus || 'Not approved'}
                      </span>
                    </td>
                    <td className="py-4 pr-4 text-slate-400">{user.twoFactorMethod}</td>
                    <td className="py-4 pr-4">
                      <select
                        value={user.role}
                        onChange={(event) => updateRole(user.id, event.target.value as AdminRole)}
                        disabled={roleChangeUserId === user.id || loading}
                        className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white"
                      >
                        <option value="user">Member</option>
                        <option value="applicant">Applicant</option>
                        <option value="provider">Provider Role Only</option>
                        <option value="admin">Admin</option>
                      </select>
                      {user.role === 'provider' && !user.providerApproved && (
                        <p className="mt-2 max-w-xs text-[10px] leading-4 text-amber-200">
                          Provider role is not the same as approved provider access. Approve through Provider Applicants to unlock provider tools.
                        </p>
                      )}
                    </td>
                    <td className="py-4 pr-4">
                      <div className="flex min-w-[220px] flex-wrap gap-2">
                        {locked ? (
                          <ActionButton
                            type="button"
                            variant="secondary"
                            disabled={protectedProfile || actionBusy || loading}
                            onClick={() => void unlockUser(user.id)}
                            icon={<UnlockKeyhole className="h-4 w-4" />}
                            className="min-h-10 px-3 py-2 text-[10px]"
                          >
                            Unlock
                          </ActionButton>
                        ) : (
                          <ActionButton
                            type="button"
                            variant="secondary"
                            disabled={protectedProfile || actionBusy || loading}
                            onClick={() => void lockUser(user.id)}
                            icon={<LockKeyhole className="h-4 w-4" />}
                            className="min-h-10 px-3 py-2 text-[10px]"
                          >
                            Lock
                          </ActionButton>
                        )}
                        <ActionButton
                          type="button"
                          variant="ghost"
                          disabled={protectedProfile || actionBusy || loading}
                          onClick={() => void deleteUser(user.id)}
                          icon={<Trash2 className="h-4 w-4" />}
                          className="min-h-10 px-3 py-2 text-[10px]"
                        >
                          {deleteConfirmUserId === user.id ? 'Confirm Delete' : 'Delete'}
                        </ActionButton>
                      </div>
                      {protectedProfile && (
                        <p className="mt-2 max-w-xs text-[10px] leading-4 text-slate-500">
                          Protected admin profile.
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SurfacePanel>
    </PageShell>
  );
};

export default AdminDashboard;
