# Meeting Action Inventory - Phase 2A

Scope: frontend meeting contract alignment only. This inventory records visible meeting/session actions after Phase 2A and the user-facing truth state.

| Label / action | Component | Status | User-facing truth state |
| --- | --- | --- | --- |
| Enter Standard Room | `components/ConsciousMeetingRoomPage.tsx` | Working for live sessions | Enabled only when the session is `live` and the user is signed in. Backend lifecycle errors show explicit not-live or ended messages. |
| Enter 5D View | `components/ConsciousMeetingRoomPage.tsx` | Gated | Enabled only for live sessions with provider-enabled immersive mode and local WebXR support. |
| Scheduled room display | `components/ConsciousMeetingRoomPage.tsx` | Unavailable due to status | Shows scheduled/host-waiting state. No room entry, media, recording, notes, or signaling actions are exposed. |
| Ended/archive room display | `components/ConsciousMeetingRoomPage.tsx` | Archive/summary state | Shows ended/archive state and replay-path truth. No active room controls are exposed. |
| Enable Media | `components/ConsciousMeetingRoomPage.tsx` | Working after live join | Enables local camera/microphone only after successful live room join. |
| Record Locally | `components/ConsciousMeetingRoomPage.tsx` | Local-only | Browser-only recording, available only when provider allows participant-side local recording and local media is active. |
| Download local recording | `components/ConsciousMeetingRoomPage.tsx` | Local-only | Downloads only browser-session recording chunks. No server archive or VOD is implied. |
| Provider create CNH room | `components/ConsciousMeetings.tsx` | Working | Provider/admin host session required. Creates backend meeting session. |
| Provider start session | `components/ConsciousMeetings.tsx` | Working for scheduled sessions | Enabled only for selected scheduled sessions. Live or ended sessions cannot be started again. |
| Provider end session | `components/ConsciousMeetings.tsx` | Working for live sessions | Enabled only for selected live sessions. Backend ends session and clears active signaling metadata. |
| Internal CNH room link copy/open | `components/ConsciousMeetings.tsx` | Working | Copies/opens the selected backend room route; room page enforces lifecycle truth. |
| Send platform invites | `components/ConsciousMeetings.tsx` | Working | Sends backend user/group invites for selected hosted session. |
| Create external link | `components/ConsciousMeetings.tsx` | Working | Creates signed guest invite link. Guest entry remains blocked until the session is live. |
| Join invited session | `components/ConsciousMeetings.tsx` | Working for live sessions | Disabled for scheduled/ended sessions. Lifecycle errors show clear status messages. |
| External guest validate link | `components/ConsciousMeetings.tsx` | Working | Previews signed guest invite and displays whether entry is live or waiting for host. |
| External guest join | `components/ConsciousMeetings.tsx` | Working for live sessions | Disabled until previewed session is live. Backend lifecycle errors show explicit messages. |
| AI synthesis notetaker | `components/ConsciousMeetings.tsx` | Unavailable / missing backend persistence | Marked unavailable until transcript capture, participant consent, secure session note storage, and permissions are implemented. |
| Initiate agent notes | `components/ConsciousMeetings.tsx` | Unavailable / missing transcript capture | Does not generate synthetic notes. User messaging states requirements. |
| Download session notes | `components/ConsciousMeetings.tsx` | Gated / missing persistence | Disabled unless real persisted notes exist. Prevents empty TXT downloads. |
| Sync notes to participants | `components/ConsciousMeetings.tsx` | Gated / missing persistence | Does not present clipboard-only behavior as participant sync. |
| Upcoming board live entry | `components/ConsciousMeetingsUpcomingPage.tsx` | Working for live sessions | Live sessions show active entry. Scheduled sessions show schedule/status, not room entry. |
| Upcoming board 5D entry | `components/ConsciousMeetingsUpcomingPage.tsx` | Gated | Disabled until the session is live. |
| Archive/vault replay | `components/ConsciousMeetingsUpcomingPage.tsx` | Gated by real VOD path | Replay language appears only when a real recording path is attached; otherwise metadata-only copy is shown. |

Phase 2B candidates: transcript capture consent flow, session-scoped notes persistence, real peer exchange/chat lifecycle, admin mock-session truth pass, server recording/VOD if explicitly approved.
