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

Keep ENABLE_PASSWORD_RESET=true for email recovery. ADMIN_NOTIFICATION_EMAIL can remain higherconscious.network1@gmail.com. SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER and SMTP_PASSWORD are not needed for this Gmail service configuration; remove stale SMTP overrides to avoid ambiguity. FRONTEND_BASE_URL should remain https://conscious-network.org.

The Gmail transport uses the authenticated EMAIL_USER as the From address, even if a stale EMAIL_FROM domain address remains in the hosting settings. The separate generic SMTP transport retains its explicit From setting for deployments using another mail provider. No domain-mail authentication or send-as alias is assumed.

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
