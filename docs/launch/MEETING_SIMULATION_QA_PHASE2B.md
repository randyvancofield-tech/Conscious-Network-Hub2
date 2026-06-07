# Phase 2B Meeting Simulation QA

## Entry Path

- Admin path: `/conscious-meetings/portal`
- Open the host console and select the visible `Admin QA` tab.
- The tab is only rendered for `user.role === 'admin'`.
- The simulation component also denies access if it is mounted for a non-admin user.

## Purpose

Phase 2B adds an admin-only meeting simulation harness for founder/admin QA. It helps inspect role and lifecycle truth states without needing a live team and without mutating real meeting records.

This is not a real meeting implementation and does not replace production meeting flows.

The corrected Phase 2B UX presents Admin QA as a guided executive workflow:

1. Select role.
2. Select lifecycle state.
3. Review the scenario result.
4. Review participant/session behavior.
5. Review feature readiness grouped as Works Today, Simulation Only, and Locked / Future Build.
6. Review next build priorities.

Top-level copy must remain visible:

- `Simulation only. No production session, invite, participant, recording, note, signal, archive, replay, or VOD record is created.`
- `Use this panel to select a role and meeting state, then verify what that user should see, what works today, what is simulated, and what remains locked for future development.`

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
- Participant list simulation
- Guest access simulation
- Waiting, ended, archive, and unknown-state messaging

Each action card must show an explicit operational label:

- `WORKS TODAY`
- `SIMULATION ONLY`
- `LOCKED / FUTURE BUILD`
- `LOCAL ONLY`
- `ROLE RESTRICTED`
- `STATUS RESTRICTED`

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
3. Confirm `Admin QA` appears as a visible text label, not only an icon.
4. Select `Admin QA`.
5. Confirm the top explanation says simulation creates no production session, invite, participant, recording, note, signal, archive, replay, or VOD record.
6. Follow the visible checklist:
   - Select role
   - Select lifecycle state
   - Review scenario result
   - Review participants
   - Review feature readiness
   - Confirm what remains locked
   - Identify next build priority
7. Switch role views:
   - Provider / Host
   - Admin
   - Authenticated Member
   - Signed Guest
8. Switch lifecycle states:
   - Scheduled
   - Live
   - Ended
   - Archived
   - Error / Unknown
9. Confirm scheduled state:
   - Join is disabled or gated.
   - Host/admin start is available only for provider/admin role view.
   - Message reads that users and signed guests cannot enter until host start.
10. Confirm live state:
   - Join is active.
   - Host/admin end is available.
   - Participant list shows host/provider, admin observer, member attendee, signed guest, late joiner, muted participant, camera-off participant, and disconnected participant.
   - Recently departed participant is visually separated and not counted as active.
11. Confirm ended state:
   - Active join, 5D, AI notes, notes download, and recording are closed or unavailable.
   - Message reads that active entry, signaling, AI notes, 5D entry, and recording controls are closed.
12. Confirm archived state:
   - Archive/metadata behavior is shown.
   - No fake replay or VOD is presented.
13. Confirm unknown/error state:
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
