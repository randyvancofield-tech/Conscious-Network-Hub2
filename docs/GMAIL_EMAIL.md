# Production Gmail delivery

Production authenticates as higherconscious.network1@gmail.com, a consumer Gmail account, not a Google Workspace account. guidance@higherconscious.network belongs to a different email service and is not a Google login or an authorized Gmail sender in this configuration.

## Manual backend environment configuration

Set the following only in the deployed backend environment (currently documented as Render):

| Variable | Value or action |
| --- | --- |
| EMAIL_SERVICE | gmail |
| EMAIL_USER | higherconscious.network1@gmail.com |
| EMAIL_FROM | higherconscious.network1@gmail.com |
| EMAIL_PASSWORD | Store the Gmail account's App Password directly as a hosting secret. No value is supplied here. |
| EMAIL_DELIVERY_ENABLED | true, after the secret is stored |
| REQUIRE_EMAIL_DELIVERY | true |

Keep ENABLE_PASSWORD_RESET=true for email recovery. ADMIN_NOTIFICATION_EMAIL can remain higherconscious.network1@gmail.com. Remove legacy SMTP_* overrides; generic SMTP selection is no longer supported by this application. Remove SUPPORT_EMAIL_TO and EMAIL_ADMIN_TO; ADMIN_NOTIFICATION_EMAIL is the sole outbound internal-recipient setting. FRONTEND_BASE_URL should remain https://conscious-network.org.

The Gmail transport uses the authenticated EMAIL_USER as the From address, even if a stale EMAIL_FROM domain address remains in the hosting settings. EMAIL_SERVICE must be gmail and EMAIL_USER must match the designated production account. Transport, sender, enablement and recipient policy are centralized in server/src/services/emailConfig.ts. No domain-mail authentication or send-as alias is assumed.

## Authentication and security

The current backend uses Nodemailer Gmail password authentication, not OAuth. It requires a Gmail App Password, with 2-Step Verification enabled on the sending Google account. The regular Google password is not appropriate. If Google does not offer App Passwords for that account, this flow cannot be enabled as documented: implement OAuth rather than weaken account security.

Enter the App Password only in the backend host's secret settings. Never put it in source control, examples, chat, or frontend VITE variables. Changing the Google account password revokes its App Passwords and requires updating the hosting secret. Runtime email errors omit raw provider error objects to avoid exposing transport details.

Restart/redeploy after saving the environment. The service initializes its transport once per process. configured() means configuration was loaded, not that Google accepted the credentials. Verify authenticated transport and an explicitly authorized test receipt before applicant delivery. SMTP acceptance alone does not guarantee inbox delivery. The host must permit outbound Gmail SMTP connections; check its plan/network restrictions if connections time out.

## Delivery and workflow

Account recovery and applicant status messages retain their current templates and portal links. Both authentication and visible sender use the Gmail address. Recipients' replies go to that Gmail inbox; incoming mail is not imported into the applicant portal. Do not use a domain From address without separately implementing and verifying its sending service.

Consumer Gmail enforces sending and abuse limits and is unsuitable for unrestricted bulk sending. Monitor bounces, rate limits, and spam-folder placement. Do not promise successful inbox delivery based only on a server success result.

Jessica's submission and follow-up previously recorded emailSent=false and emailSkipped=true. Skipped sends are not stored in a retry queue. Her follow-up therefore still needs manual resend after delivery is operational and verified; enabling email will not resend it. Include her applicant portal URL and login email, never her password. No resend or production credential change is performed by this remediation.

## Official references (checked September 6, 2026)

- https://support.google.com/accounts/answer/185833
- https://support.google.com/mail/answer/7104828
- https://support.google.com/mail/answer/22839

## Failed production verification and next diagnostic attempt

The September 6 support/contact test recorded an internal ticket, emailConfigured=true and emailSent=false. Configuration presence does not prove Gmail authentication. The request waited a long time before returning failure. Without Render logs the exact cause is unconfirmed. A connection timeout is plausible, not established.

Render free web services block outbound ports 25, 465 and 587. Gmail SMTP therefore needs a paid Render instance with SMTP egress. Confirm the current instance type before retrying. Changing mailbox defaults or App Passwords cannot fix an egress block. Source: https://render.com/docs/free

After deploying this remediation, a single controlled test to the admin mailbox is appropriate if SMTP egress is available. Never resend Jessica's message as a diagnostic probe. Logs now emit only a fixed failure class, allowlisted error code, and numeric SMTP error status; no raw error, response, command, credentials, message body, or recipient. EAUTH indicates authentication; ETIMEDOUT/connection codes indicate network or greeting problems; TLS/socket and delivery rejection have distinct classes. Unknown failures remain unknown rather than leaking raw details. Connection/greeting waits are 15 seconds each, with a 30-second idle socket timeout. These diagnostics do not make transport configured() a connectivity check.

Disabled flags in server/.env.example and email-disabled test cases are intentional local/test safeguards. They are not production instructions. Invalid enabled configuration fails rather than selecting a legacy fallback. Both production flags must be true. Internal notices use ADMIN_NOTIFICATION_EMAIL, defaulting to higherconscious.network1@gmail.com.
