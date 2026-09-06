# Optional external password-recovery delivery

Normal HCN correspondence now uses the [internal mailbox](INTERNAL_CORRESPONDENCE.md). Support, issue reporting, applicant acknowledgements, review decisions, and administrative correspondence do not send SMTP email. `/api/support/contact` is no longer an SMTP test endpoint.

External delivery remains for password recovery because a person locked out of HCN cannot read their internal mailbox. Recovery routes, validation, tokens, recovery codes and authentication behavior are unchanged. Do not redesign recovery as part of mailbox rollout.

## Backend configuration

No new email variables are needed for internal mail. Preserve existing database, sensitive-data encryption and private-upload secrets. For external recovery email only:

| Variable | Value/action |
| --- | --- |
| EMAIL_SERVICE | gmail |
| EMAIL_USER | higherconscious.network1@gmail.com |
| EMAIL_FROM | higherconscious.network1@gmail.com |
| EMAIL_PASSWORD | Gmail App Password stored only in the backend host's secret settings |
| EMAIL_DELIVERY_ENABLED | true only when external recovery delivery is operational |
| REQUIRE_EMAIL_DELIVERY | true when external recovery delivery is enabled |
| ENABLE_PASSWORD_RESET | Preserve the existing true setting |
| FRONTEND_BASE_URL | https://conscious-network.org |

If external delivery is unavailable, setting both delivery flags to false leaves internal correspondence operational. This disables the external transport; it does not repair or replace external recovery. Existing recovery-code behavior remains as implemented. An explicitly enabled but invalid email configuration still fails startup validation. Do not leave contradictory flags.

`ADMIN_NOTIFICATION_EMAIL` is a retained legacy configuration field without an active outbound admin-notification caller. `ADMIN_INBOX_RECIPIENT_EMAIL` labels historical intake records; it neither routes private correspondence nor grants access. Internal routing uses canonical user IDs and the shared administration mailbox. Old `SMTP_*`, `SUPPORT_EMAIL_TO` and `EMAIL_ADMIN_TO` overrides are not used.

The sending account is consumer Gmail, not Google Workspace. `guidance@higherconscious.network` belongs to a separate service and must not authenticate through Google or be assumed to be a Gmail alias. The transport derives From from the designated Gmail user.

## Security and verification

The retained Nodemailer password transport requires an App Password with Google 2-Step Verification enabled. Never use the ordinary Google password or put credentials in frontend variables, documentation, source control or chat. Account policies can make App Passwords unavailable; do not weaken account security to work around that. [Google App Password guidance](https://support.google.com/accounts/answer/185833).

The host must permit SMTP egress. Render documents blocked outbound SMTP ports on free web services. Verify the deployed instance's networking before diagnosing credentials. [Render free-service limits](https://render.com/docs/free).

`configured()` reports loaded configuration, not successful Gmail authentication. Runtime diagnostics retain only allowlisted failure classes/codes and numeric SMTP status. Connection and greeting timeouts are 15 seconds; idle socket timeout is 30 seconds. Provider acceptance is not a guarantee of inbox placement. Test recovery only with an explicitly authorized account and never log a reset link or token.

## Historical failed verification and Jessica

The September 6 support/contact test saved an internal ticket but returned `emailSent=false`. The exact provider error was unavailable; SMTP authentication was never proven. Internal correspondence bypasses that transport; it does not establish that Gmail was repaired.

Jessica's earlier follow-up recorded `emailSkipped=true` and `emailSent=false`. No external retry queue exists and enabling delivery does not resend it. Any saved lifecycle notice appears in her mailbox through the historical-notification adapter. Administration should inspect that history and deliberately send any missing follow-up through her internal mailbox after rollout. If an external introduction to the portal is still needed, it remains a separate manual follow-up through a working external channel. Never include a password. This implementation does not resend Jessica's message.
