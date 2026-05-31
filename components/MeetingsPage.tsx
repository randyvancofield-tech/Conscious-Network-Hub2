import React, { useMemo } from 'react';
import { ArrowLeft, CalendarClock, Clock, Radio, UserRound, Users, Video } from 'lucide-react';
import { MEETING_SURFACE_RECORDS, MeetingSurfaceRecord } from '../services/platformData';
import { ActionButton, EmptyState, PageHeader, PageShell, SurfacePanel } from './ui/PlatformPrimitives';

type MeetingsPageProps = {
  meetingId?: string;
  onOpenMeeting: (id: string) => void;
  onBackToList: () => void;
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

const toDateLabel = (value: string): string => dateFormatter.format(new Date(value));
const toTimeLabel = (value: string): string => timeFormatter.format(new Date(value));

const getStatusClass = (status: MeetingSurfaceRecord['status']): string => {
  if (status === 'live') return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200';
  if (status === 'scheduled') return 'border-blue-400/40 bg-blue-500/10 text-blue-200';
  if (status === 'replay') return 'border-violet-400/40 bg-violet-500/10 text-violet-200';
  return 'border-slate-500/40 bg-slate-500/10 text-slate-300';
};

export const JoinMeetingButton: React.FC<{ meeting: MeetingSurfaceRecord }> = ({ meeting }) => {
  const label = meeting.status === 'replay' ? 'Open Replay' : meeting.status === 'live' ? 'Join Live Session' : 'Reserve Seat';
  return (
    <ActionButton
      type="button"
      disabled
      icon={meeting.status === 'replay' ? <Video className="h-4 w-4" /> : <Radio className="h-4 w-4" />}
      title="This meeting action is being prepared."
    >
      {label}
    </ActionButton>
  );
};

export const MeetingCard: React.FC<{
  meeting: MeetingSurfaceRecord;
  onOpen: (id: string) => void;
}> = ({ meeting, onOpen }) => {
  const capacityUsed = Math.min(100, Math.round((meeting.participantCount / Math.max(meeting.capacity, 1)) * 100));

  return (
    <SurfacePanel className="flex h-full flex-col gap-6 transition-colors hover:border-blue-400/30">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${getStatusClass(meeting.status)}`}>
          {meeting.status}
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300">
          {meeting.deliveryMode}
        </span>
      </div>

      <div className="space-y-3">
        <h2 className="text-2xl font-black uppercase leading-tight text-white">{meeting.title}</h2>
        <p className="text-sm leading-6 text-slate-400">{meeting.description}</p>
      </div>

      <div className="grid gap-3 text-sm text-slate-300">
        <div className="flex items-center gap-3">
          <UserRound className="h-4 w-4 text-blue-300" />
          <span>{meeting.providerName}</span>
        </div>
        <div className="flex items-center gap-3">
          <CalendarClock className="h-4 w-4 text-teal-300" />
          <span>{toDateLabel(meeting.startTime)}</span>
        </div>
        <div className="flex items-center gap-3">
          <Clock className="h-4 w-4 text-slate-400" />
          <span>
            {toTimeLabel(meeting.startTime)} - {toTimeLabel(meeting.endTime)}
          </span>
        </div>
      </div>

      <div className="mt-auto space-y-3">
        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
          <span>Capacity</span>
          <span>
            {meeting.participantCount}/{meeting.capacity}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-teal-300" style={{ width: `${capacityUsed}%` }} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionButton type="button" variant="secondary" onClick={() => onOpen(meeting.id)}>
            Details
          </ActionButton>
          <JoinMeetingButton meeting={meeting} />
        </div>
      </div>
    </SurfacePanel>
  );
};

export const MeetingList: React.FC<{
  meetings: MeetingSurfaceRecord[];
  onOpenMeeting: (id: string) => void;
}> = ({ meetings, onOpenMeeting }) => {
  const upcoming = meetings.filter((meeting) => meeting.status === 'scheduled' || meeting.status === 'live');
  const past = meetings.filter((meeting) => meeting.status === 'completed' || meeting.status === 'replay');

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Upcoming Sessions</h2>
        {upcoming.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {upcoming.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} onOpen={onOpenMeeting} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<CalendarClock className="h-7 w-7" />}
            title="No upcoming sessions"
            description="Scheduled provider sessions will appear here when they are available."
          />
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Past And Replay Sessions</h2>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {past.map((meeting) => (
            <MeetingCard key={meeting.id} meeting={meeting} onOpen={onOpenMeeting} />
          ))}
        </div>
      </section>
    </div>
  );
};

export const MeetingDetail: React.FC<{
  meeting: MeetingSurfaceRecord;
  onBack: () => void;
}> = ({ meeting, onBack }) => (
  <PageShell>
    <ActionButton type="button" variant="ghost" onClick={onBack} icon={<ArrowLeft className="h-4 w-4" />}>
      Meetings
    </ActionButton>

    <PageHeader
      eyebrow={`${meeting.deliveryMode} session`}
      title={meeting.title}
      description={meeting.description}
      actions={<JoinMeetingButton meeting={meeting} />}
    />

    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_0.8fr]">
      <SurfacePanel className="space-y-6">
        <div className="aspect-video rounded-2xl border border-white/10 bg-gradient-to-br from-blue-950/60 via-slate-950 to-teal-950/50 p-6">
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Video className="mb-4 h-12 w-12 text-blue-300" />
            <h2 className="text-xl font-black uppercase text-white">Legacy Meeting Surface Disabled</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
              Live rooms now open through backend CNH room links and the Conscious Meetings upcoming board.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            ['Date', toDateLabel(meeting.startTime)],
            ['Time', `${toTimeLabel(meeting.startTime)} - ${toTimeLabel(meeting.endTime)}`],
            ['Access', meeting.accessTier],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
              <p className="mt-1 text-sm font-bold text-white">{value}</p>
            </div>
          ))}
        </div>
      </SurfacePanel>

      <SurfacePanel className="space-y-5">
        <h2 className="text-lg font-black uppercase text-white">Provider Association</h2>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Provider</p>
          <p className="mt-1 text-base font-bold text-white">{meeting.providerName}</p>
          <p className="mt-2 break-words text-xs text-slate-400">Provider ID: {meeting.providerId}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Capacity</p>
            <Users className="h-4 w-4 text-blue-300" />
          </div>
          <p className="text-2xl font-black text-white">
            {meeting.participantCount}/{meeting.capacity}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Attendance will update here when session participation is available.
          </p>
        </div>
      </SurfacePanel>
    </div>
  </PageShell>
);

const MeetingsPage: React.FC<MeetingsPageProps> = ({ meetingId, onOpenMeeting, onBackToList }) => {
  const selectedMeeting = useMemo(
    () => MEETING_SURFACE_RECORDS.find((meeting) => meeting.id === meetingId) || null,
    [meetingId]
  );

  if (meetingId && !selectedMeeting) {
    return (
      <PageShell>
        <EmptyState
          icon={<Video className="h-7 w-7" />}
          title="Meeting access unavailable"
          description="No real backend meeting is available for this legacy surface. Use the upcoming board or a signed CNH room link."
          action={
            <ActionButton type="button" onClick={onBackToList} icon={<ArrowLeft className="h-4 w-4" />}>
              Back to Meetings
            </ActionButton>
          }
        />
      </PageShell>
    );
  }

  if (selectedMeeting) {
    return <MeetingDetail meeting={selectedMeeting} onBack={onBackToList} />;
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Provider-hosted sessions"
        title="Meetings"
        description="Provider-hosted live sessions, scheduled gatherings, and replays will appear here as they become available."
      />
      <MeetingList meetings={MEETING_SURFACE_RECORDS} onOpenMeeting={onOpenMeeting} />
    </PageShell>
  );
};

export default MeetingsPage;
