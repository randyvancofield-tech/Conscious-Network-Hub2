import React, { useEffect, useMemo, useState } from 'react';
import { KeyRound, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { api, ApiError } from '../services/apiClient';
import { getAdminElevationToken, setAdminElevationToken } from '../services/sessionService';
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
  twoFactorMethod: string;
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

const AdminDashboard: React.FC = () => {
  const [password, setPassword] = useState('');
  const [dashboard, setDashboard] = useState<AdminDashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [elevating, setElevating] = useState(false);
  const [error, setError] = useState('');
  const [roleChangeUserId, setRoleChangeUserId] = useState<string | null>(null);

  const isElevated = useMemo(() => Boolean(getAdminElevationToken()), [dashboard, error]);

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
    setElevating(true);
    setError('');
    try {
      const data = await api<{ elevationToken: string }>('/admin/elevate', {
        method: 'POST',
        body: { password },
      });
      setAdminElevationToken(data.elevationToken);
      setPassword('');
      await loadDashboard();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to elevate admin session.');
    } finally {
      setElevating(false);
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
          reason: 'Admin dashboard role management',
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
                required
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
        description="Full platform visibility for user roles, memberships, provider access, and governance checks."
        actions={
          <ActionButton type="button" variant="secondary" onClick={loadDashboard} icon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </ActionButton>
        }
      />

      {error && <EmptyState title="Admin action failed" description={error} />}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
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
          <h2 className="text-sm font-black uppercase text-white">Recent Users</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-3 pr-4">Identity</th>
                <th className="py-3 pr-4">Role</th>
                <th className="py-3 pr-4">Tier</th>
                <th className="py-3 pr-4">2FA</th>
                <th className="py-3 pr-4">Role Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {dashboard.recentUsers.map((user) => (
                <tr key={user.id}>
                  <td className="py-4 pr-4">
                    <p className="font-bold text-white">{user.name || user.email}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </td>
                  <td className="py-4 pr-4 text-slate-200">{user.role}</td>
                  <td className="py-4 pr-4 text-slate-400">{user.tier || 'None'}</td>
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
                      <option value="provider">Provider</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfacePanel>
    </PageShell>
  );
};

export default AdminDashboard;
