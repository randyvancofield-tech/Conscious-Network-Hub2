# Mobile Install And Wallet Readiness

Date captured: 2026-06-24

## Current State

- The active repo is a React/Vite web app with PWA install assets.
- No Android, iOS, Capacitor, Cordova, Bubblewrap, TWA, APK, AAB, or IPA project is present in this checkout.
- Admin/provider wallet authentication uses injected EIP-1193 providers when present.
- Mobile standalone/browser authentication now uses MetaMask Connect EVM as the mobile-safe EIP-1193 transport.
- The old mobile fallback that opened the entire HCN page inside MetaMask's in-app browser is no longer the primary authentication path.

## Root Cause Summary

Desktop works because the MetaMask extension injects `window.ethereum` into the same browser context where HCN is already running. The pending JavaScript wallet request resolves in that same tab, then HCN stores the returned session tokens in that same tab's `sessionStorage`.

Mobile does not have that same shared injected-extension context. The former fallback opened MetaMask's in-app browser, where authentication could complete in a separate browser container from the installed PWA. HCN now uses MetaMask Connect EVM so the PWA keeps the wallet request promise and receives the resulting EIP-1193 account/signature response in the HCN context.

## Code-Level Readiness Added

- Manifest identity is explicit with `id`, `scope`, `start_url`, language, categories, `display_override`, and app shortcuts.
- Service worker cache version was bumped and `/.well-known/` is excluded from shell caching so future Android Digital Asset Links and Apple association files are fetched directly.
- MetaMask mobile deeplinks now use the current MetaMask documented `https://link.metamask.io/dapp/...` host.
- MetaMask Connect EVM was added for mobile-safe account connection and gasless SIWE-style signatures.
- MetaMask Connect now runs in headless mode for HCN mobile/PWA wallet actions, so the app owns the user-facing wallet prompt instead of showing a generic connector modal.
- Mobile MetaMask Connect handoff uses the MetaMask universal connect link, which opens the MetaMask app when available and gives users a clearer install path when it is not.
- Installed-app wallet actions now enable the primary Verify/Bind button even without an injected provider when the MetaMask Connect transport is available.

## Wallet Authentication UX Matrix

| Environment | Primary HCN behavior |
| --- | --- |
| Desktop browser with MetaMask extension | Use the injected EIP-1193 provider directly. |
| Desktop browser without MetaMask extension | Show desktop extension guidance; do not show mobile-first connector steps. |
| Android mobile browser | Show a direct Continue with MetaMask app action through MetaMask Connect. |
| Android installed PWA | Keep the session in HCN and hand off to MetaMask app through MetaMask Connect. |
| iOS Safari browser | Use the MetaMask app handoff when possible and tell users iOS may require switching back to HCN. |
| iOS installed PWA | Use the same MetaMask app handoff with explicit iOS return guidance. |
| MetaMask in-app browser | Use the injected provider already present in the current browser context. |
| Other mobile browser | Prefer MetaMask app handoff on secure HTTPS; guide install/unlock if the app does not open. |

## Platform Setup Required Outside This Repo

Android trusted native/TWA path:
- Create an Android package, preferably a Trusted Web Activity if the app remains web-first.
- Build a signed Android App Bundle for Play distribution.
- Enroll in Google Play App Signing and publish through Play Console tracks.
- Generate `assetlinks.json` with the final package name and release signing certificate SHA-256 fingerprint.
- Serve `/.well-known/assetlinks.json` from `https://conscious-network.org` with `application/json`.
- Keep all app traffic HTTPS and keep production security headers active.
- Avoid direct APK downloads for normal users; sideload warnings are expected for unknown-source APK distribution.

iOS trusted path:
- For PWA-only access, guide users to Safari's Add to Home Screen flow.
- Add final Apple touch icons and keep apple web app meta tags active.
- If native iOS distribution is required, use Apple Developer Program, TestFlight, and App Store review.
- If universal links are required for native callback routing, serve `/.well-known/apple-app-site-association` for the final app ID and associated domains entitlement.

## Provider/Member Install Guidance

Recommended user-facing copy until store-level trust is complete:

Install Higher Conscious Network from the secure website only: `https://conscious-network.org`.
On Android or desktop Chrome/Edge, use the browser's Install app prompt or Add to Home Screen option.
On iPhone or iPad, open the site in Safari, tap Share, then Add to Home Screen.
Do not install HCN from a downloaded APK or file attachment unless operations has explicitly provided a signed internal testing build.
For administrator or provider wallet verification on mobile, tap the HCN wallet verification button, approve the gasless MetaMask prompts, and let HCN complete the session after MetaMask returns.

## Recommended Launch Path

1. PWA-only for the immediate web launch: safest and lowest operational risk.
2. Trusted Web Activity on Android for store-trusted install once Play Console, signing, and Digital Asset Links are ready.
3. TestFlight/App Store only if native iOS capabilities or universal-link callback behavior become required.
4. Keep MetaMask Connect as the scoped wallet-auth transport and test it across desktop extension, mobile browser, installed PWA, and provider/admin roles before widening to other wallet families.
