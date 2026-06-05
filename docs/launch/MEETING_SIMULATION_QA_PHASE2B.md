# Phase 2B Meeting Simulation QA

## Entry Path

- Admin path: `/conscious-meetings/portal`
- Open the host console and select the `Admin QA` tab.
- The tab is only rendered for `user.role === 'admin'`.
- The simulation component also denies access if it is mounted for a non-admin user.

## Purpose

Phase 2B adds an admin-only meeting simulation harness for founder/admin QA. It helps inspect role and lifecycle truth states without needing a live team and without mutating real meeting records.

This is not a real meeting implementation and does not replace production meeting flows.

## Roles Simulated

- Provider / Host
- Admin
- Authenticated Member
- Signed Guest

## Lifecycle States Simulated

- Scheduled
- Live
- Ended
- Archived
- Error / Unknown

## Actions Covered

- Join visibility and availability
- Provider/admin start control
- Provider/admin end control
- Participant list visibility
- AI notes lock state
- Notes download availability
- Browser-local recording truth state
- 5D entry lifecycle state
- Waiting, ended, archive, and unknown-state messaging

## What Is Real

- Uses the same frontend meeting console area as the production host surface.
- Uses the existing frontend `MeetingSessionSummary` TypeScript shape for simulated session state.
- Uses the same Phase 2A truth-state assumptions:
  - non-live sessions are not active rooms
  - AI notes are locked
  - notes download requires persisted notes
  - recording is browser-local only
  - 5D entry is lifecycle-gated

## What Is Simulated

- Meeting session lifecycle transitions
- Participant presence and mic/camera states
- Signed guest concept
- Invited member/group concept
- Host/admin/member/guest role views
- Action availability matrix

## What Is Not Implemented Here

- Real WebRTC peer exchange
- Real AI notes
- Transcript capture
- Notes persistence
- Chat persistence
- Server recording
- Replay/VOD
- Real external invite generation
- Real participant mutation

## Data Safety

The simulation is frontend-local. It does not call provider session creation, invite, join, start, end, signal, recording, note, or archive APIs. It must not create real participants, send real invites, persist fake notes, or attach fake VOD paths.

## Manual QA Steps

1. Sign in as founder/admin.
2. Open `/conscious-meetings/portal`.
3. Select `Admin QA`.
4. Switch role views:
   - Provider / Host
   - Admin
   - Authenticated Member
   - Signed Guest
5. Switch lifecycle states:
   - Scheduled
   - Live
   - Ended
   - Archived
   - Error / Unknown
6. Confirm scheduled state:
   - Join is disabled or gated.
   - Host/admin start is available only for provider/admin role view.
   - Message reads that users and signed guests cannot enter until host start.
7. Confirm live state:
   - Join is active.
   - Host/admin end is available.
   - Participant list shows host/provider, admin observer, member attendee, signed guest, late joiner, muted participant, camera-off participant, and disconnected participant.
8. Confirm ended state:
   - Active join, 5D, AI notes, notes download, and recording are closed or unavailable.
   - Message reads that active entry, signaling, AI notes, 5D entry, and recording controls are closed.
9. Confirm archived state:
   - Archive/metadata behavior is shown.
   - No fake replay or VOD is presented.
10. Confirm unknown/error state:
    - The UI fails closed and avoids active controls.

## Expected Copy Checks

- AI notes: `AI notes are locked until real transcript capture, participant consent, session-scoped persistence, and permission checks are implemented.`
- Notes download: `Notes download is unavailable because this QA session has no persisted notes.`
- Recording: `Recording is browser-local only. No cloud recording, server archive, replay, or VOD is created.`
- Scheduled/waiting: `This simulated CNH room is scheduled. Users and signed guests cannot enter until the host starts the session.`
- Ended: `This simulated meeting has ended. Active entry, signaling, AI notes, 5D entry, and recording controls are closed.`
- 5D: `5D entry is disabled until the room is live and the gateway is enabled.`

## Remaining Follow-Up

Phase 2B stops at simulation. Do not proceed to AI notes lifecycle, transcript capture, real WebRTC peer exchange, chat, server recording, or VOD until Phase 2B is reviewed and accepted.
