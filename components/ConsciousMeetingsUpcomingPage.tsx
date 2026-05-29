import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  CalendarClock,
  Clock,
  Filter,
  Layers,
  PlayCircle,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
  UserRound,
  Users,
  Video,
} from 'lucide-react';
import { UserProfile } from '../types';
import {
  listArchivedMeetingSessions,
  listUpcomingMeetingSessions,
  MeetingSessionSummary,
} from '../services/backendApiService';
import { ActionButton, EmptyState, LoadingPanel, PageHeader, PageShell, SurfacePanel } from './ui/PlatformPrimitives';

type ConsciousMeetingsUpcomingPageProps = {
  user: UserProfile | null;
  onOpenMeeting: (id: string) => void;
  onOpenPortal: () => void;
};

type ArchiveEntry = {
  id: string;
  title: string;
  description: string;
  providerName: string;
  focusArea: string;
  startTimeMs: number;
  vodPath: string;
  source: 'cloud' | 'surface';
};

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const fullDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const getSessionStartMs = (session: MeetingSessionSummary): number =>
  session.scheduledAtMs || session.startedAtMs || session.createdAtMs || Date.now();

const getProviderName = (session: MeetingSessionSummary): string =>
  session.providerDisplayName || 'Verified Provider';

const getFocusArea = (session: MeetingSessionSummary): string =>
  session.focusArea || (session.mode === 'immersive-5d' ? 'Spatial 5D Practice' : 'Conscious Development');

const toRoomEndpoint = (session: MeetingSessionSummary): string => session.routeKey || session.id;

const ConsciousMeetingsUpcomingPage: React.FC<ConsciousMeetingsUpcomingPageProps> = ({
  user,
  onOpenMeeting,
  onOpenPortal,
}) => {
  const [upcomingSessions, setUpcomingSessions] = useState<MeetingSessionSummary[]>([]);
  const [archivedSessions, setArchivedSessions] = useState<MeetingSessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [topicFilter, setTopicFilter] = useState('all');
  const [archiveSearch, setArchiveSearch] = useState('');

  const refreshSessions = useCallback(async () => {
    if (!user) {
      setUpcomingSessions([]);
      setArchivedSessions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const [upcoming, archived] = await Promise.all([
      listUpcomingMeetingSessions(),
      listArchivedMeetingSessions(),
    ]);
    setUpcomingSessions(upcoming);
    setArchivedSessions(archived);
    setLastUpdatedAt(Date.now());
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    void refreshSessions();
    const timer = window.setInterval(() => {
      void refreshSessions();
    }, 15000);
    window.addEventListener('focus', refreshSessions);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshSessions);
    };
  }, [refreshSessions]);

  const topics = useMemo(() => {
    const topicSet = new Set<string>();
    upcomingSessions.forEach((session) => topicSet.add(getFocusArea(session)));
    archivedSessions.forEach((session) => topicSet.add(getFocusArea(session)));
    return Array.from(topicSet).filter(Boolean).sort();
  }, [archivedSessions, upcomingSessions]);

  const filteredUpcoming = useMemo(() => {
    const sessions = [...upcomingSessions].sort((a, b) => getSessionStartMs(a) - getSessionStartMs(b));
    if (topicFilter === 'all') return sessions;
    return sessions.filter((session) => getFocusArea(session) === topicFilter);
  }, [topicFilter, upcomingSessions]);

  const archiveEntries = useMemo<ArchiveEntry[]>(() => {
    const backendArchive = archivedSessions.map((session) => ({
      id: session.routeKey || session.id,
      title: session.title,
      description: session.description || 'Completed provider live stream archived for replay access.',
      providerName: getProviderName(session),
      focusArea: getFocusArea(session),
      startTimeMs: session.endedAtMs || getSessionStartMs(session),
      vodPath: session.vodPath || `/vod/conscious-meetings/${session.id}.mp4`,
      source: 'cloud' as const,
    }));
    const search = archiveSearch.trim().toLowerCase();
    return backendArchive
      .filter((entry) => topicFilter === 'all' || entry.focusArea === topicFilter)
      .filter((entry) => {
        if (!search) return true;
        return `${entry.title} ${entry.description} ${entry.providerName} ${entry.focusArea}`
          .toLowerCase()
          .includes(search);
      })
      .sort((a, b) => b.startTimeMs - a.startTimeMs);
  }, [archiveSearch, archivedSessions, topicFilter]);

  const recommendations = useMemo(() => {
    const interestText = `${user?.interests?.join(' ') || ''} ${user?.bio || ''}`.toLowerCase();
    const source = [...filteredUpcoming, ...archivedSessions].filter(Boolean);
    const scored = source
      .map((session) => {
        const searchable = `${session.title} ${session.description || ''} ${getFocusArea(session)} ${getProviderName(session)}`.toLowerCase();
        const score =
          user?.interests?.reduce((total, interest) => {
            const normalized = interest.toLowerCase();
            return total + (normalized && searchable.includes(normalized) ? 2 : 0);
          }, 0) || (interestText && searchable.includes(interestText) ? 1 : 0);
        return { session, score };
      })
      .sort((a, b) => b.score - a.score || getSessionStartMs(a.session) - getSessionStartMs(b.session));
    return scored.slice(0, 3).map((entry) => entry.session);
  }, [archivedSessions, filteredUpcoming, user]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Conscious Meetings"
        title="Upcoming Sessions"
        description="A native meeting board for provider-created live sessions, archived wisdom, and resonance-based recommendations inside Conscious Network Hub."
        actions={
          <>
            <ActionButton type="button" variant="secondary" onClick={refreshSessions} icon={<RefreshCw className="h-4 w-4" />}>
              Refresh
            </ActionButton>
            <ActionButton type="button" onClick={onOpenPortal} icon={<Video className="h-4 w-4" />}>
              Meeting Portal
            </ActionButton>
          </>
        }
      />

      <SurfacePanel className="grid gap-4 md:grid-cols-[1fr_0.65fr]">
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-200">Live stream listener</p>
          <p className="text-sm leading-6 text-slate-400">
            Verified provider schedules are refreshed automatically and published here as internal CNH room routes.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-2xl font-black text-white">{upcomingSessions.length}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Upcoming</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-2xl font-black text-white">{archiveEntries.length}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Vault Items</p>
          </div>
        </div>
      </SurfacePanel>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-white">Upcoming Sessions Live Board</h2>
            <p className="mt-1 text-xs text-slate-500">
              {lastUpdatedAt ? `Last synced ${dateTimeFormatter.format(lastUpdatedAt)}` : 'Waiting for the first sync'}
            </p>
          </div>
          <label className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <Filter className="h-4 w-4 text-blue-300" />
            <select
              value={topicFilter}
              onChange={(event) => setTopicFilter(event.target.value)}
              className="min-w-0 bg-transparent text-xs font-bold text-white outline-none"
            >
              <option value="all">All Topics</option>
              {topics.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          </label>
        </div>

        {isLoading ? (
          <LoadingPanel label="Listening for provider schedules..." />
        ) : filteredUpcoming.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {filteredUpcoming.map((session) => {
              const participantCount = session.participants?.length || 0;
              const capacityUsed = Math.min(100, Math.round((participantCount / Math.max(session.maxViewers, 1)) * 100));
              const isLive = session.status === 'live';
              return (
                <SurfacePanel key={session.id} className="flex h-full flex-col gap-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-widest ${
                      isLive
                        ? 'border-emerald-300/40 bg-emerald-400/10 text-emerald-200'
                        : 'border-blue-300/40 bg-blue-400/10 text-blue-200'
                    }`}>
                      {isLive ? 'Live Now' : 'Scheduled'}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-slate-300">
                      {session.mode === 'immersive-5d' ? '5D Ready' : 'Standard Ready'}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xl font-black uppercase leading-tight text-white">{session.title}</h3>
                    <p className="text-sm leading-6 text-slate-400">
                      {session.description || 'Provider-hosted Conscious Network Hub session.'}
                    </p>
                  </div>

                  <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                    <span className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-blue-300" />
                      {getProviderName(session)}
                    </span>
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-teal-300" />
                      {getFocusArea(session)}
                    </span>
                    <span className="flex items-center gap-2">
                      <CalendarClock className="h-4 w-4 text-indigo-300" />
                      {fullDateTimeFormatter.format(getSessionStartMs(session))}
                    </span>
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-slate-400" />
                      {participantCount}/{session.maxViewers} participants
                    </span>
                  </div>

                  <div className="mt-auto space-y-3">
                    <div className="h-2 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-teal-300" style={{ width: `${capacityUsed}%` }} />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <ActionButton
                        type="button"
                        onClick={() => onOpenMeeting(toRoomEndpoint(session))}
                        icon={isLive ? <Radio className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                      >
                        {isLive ? 'Enter Live Room' : 'Open Room'}
                      </ActionButton>
                      <ActionButton
                        type="button"
                        variant="secondary"
                        onClick={() => onOpenMeeting(toRoomEndpoint(session))}
                        icon={<Layers className="h-4 w-4" />}
                      >
                        5D Experience
                      </ActionButton>
                    </div>
                  </div>
                </SurfacePanel>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<CalendarClock className="h-7 w-7" />}
            title="No provider sessions posted yet"
            description={
              user
                ? 'Certified providers will appear here as soon as they schedule a public Conscious Meeting.'
                : 'Sign in to see member-ready provider meeting sessions.'
            }
            action={
              user ? (
                <ActionButton type="button" variant="secondary" onClick={onOpenPortal} icon={<Video className="h-4 w-4" />}>
                  Open Meeting Portal
                </ActionButton>
              ) : undefined
            }
          />
        )}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <SurfacePanel className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-white">Archived Wisdom Vault</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">Completed streams point to immutable VOD paths on the cloud file network.</p>
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={archiveSearch}
                onChange={(event) => setArchiveSearch(event.target.value)}
                placeholder="Search topic"
                className="w-full min-w-0 bg-transparent text-xs text-white outline-none placeholder:text-slate-600"
              />
            </label>
          </div>

          <div className="grid gap-3">
            {archiveEntries.slice(0, 6).map((entry) => (
              <div key={`${entry.source}-${entry.id}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <p className="text-xs font-black uppercase text-white">{entry.title}</p>
                    <p className="text-xs leading-5 text-slate-400">{entry.description}</p>
                    <div className="flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500">
                      <span>{entry.providerName}</span>
                      <span>{entry.focusArea}</span>
                      <span>{dateTimeFormatter.format(entry.startTimeMs)}</span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[8px] font-black uppercase tracking-widest text-slate-300">
                    <Archive className="h-3 w-3" />
                    VOD
                  </span>
                </div>
                <p className="mt-3 break-all rounded-lg bg-black/20 px-3 py-2 text-[10px] text-slate-500">{entry.vodPath}</p>
              </div>
            ))}
          </div>
        </SurfacePanel>

        <SurfacePanel className="space-y-5">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-white">Energetic Resonance Recommendations</h2>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Suggestions are shaped by your profile interests, favorite focus areas, and provider interactions.
            </p>
          </div>

          <div className="space-y-3">
            {recommendations.length > 0 ? (
              recommendations.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => onOpenMeeting(toRoomEndpoint(session))}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition-all hover:border-blue-300/30 hover:bg-white/[0.06]"
                >
                  <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-blue-200">
                    <PlayCircle className="h-4 w-4" />
                    {session.status === 'ended' ? 'Archive' : session.status}
                  </span>
                  <span className="mt-2 block text-sm font-black uppercase text-white">{session.title}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{getFocusArea(session)} with {getProviderName(session)}</span>
                </button>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm leading-6 text-slate-500">
                Recommendations will refine as your meeting history and profile interests grow.
              </div>
            )}
          </div>
        </SurfacePanel>
      </section>
    </PageShell>
  );
};

export default ConsciousMeetingsUpcomingPage;
