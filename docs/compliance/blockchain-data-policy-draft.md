# Blockchain and Wallet Data Policy - Conscious Network Hub

**Effective Date:** July 8, 2026
**Last Updated:** July 8, 2026

Conscious Network Hub ("CNH") may use wallet signatures and blockchain-related records for selected identity, provider, admin, provenance, or integrity workflows. Blockchain technology can be public, global, persistent, and difficult or impossible to erase. This policy explains how CNH handles blockchain and wallet-related data for national and global launch readiness.

## 1. Launch Wallet Boundaries

- Regular users and members do not need wallet verification for normal account access.
- Applicants do not need wallet verification before provider approval.
- Approved providers may need wallet binding and wallet verification before Provider CRM or provider-control access.
- Admins may be subject to stricter wallet, elevation, and security boundaries.
- Provider wallet verification never grants admin permissions.

## 2. What Wallet Data We Process

CNH may process:
- Wallet address.
- Signed authentication or verification challenge.
- Challenge nonce, chain/network identifier, issue time, expiration time, and verification result.
- Provider wallet binding status.
- Admin wallet verification status where required.
- Audit logs related to wallet challenge and verification attempts.

CNH does not request or store wallet private keys, seed phrases, or recovery phrases. Users should never share those secrets with CNH or anyone claiming to represent CNH.

## 3. On-Chain and Off-Chain Approach

CNH favors off-chain storage for personal information.

- **Off-chain:** Account records, provider/application data, notifications, admin notes, recovery-code hashes, and private content should remain in controlled databases where access, retention, correction, and deletion can be managed.
- **On-chain or wallet-visible:** Wallet addresses, transaction references, public network events, cryptographic hashes, or provenance records may be public or persistent depending on the network and feature.

Where blockchain proofs are used, CNH should avoid placing unnecessary personal information on-chain.

## 4. Signature Safety

Wallet signatures used by CNH should be clear, gasless authentication or verification messages unless the wallet itself presents a separate blockchain transaction. Users should review the domain, message, URI, chain ID, nonce, issued time, and expiration time before signing.

CNH will not ask users to sign blank, unexplained, or private-key-revealing messages.

## 5. Immutability and Deletion Limits

Privacy laws may provide rights to deletion, correction, objection, restriction, or portability. CNH can act on off-chain data where legally and technically feasible. Public blockchain records, third-party wallet records, and public network activity may remain outside CNH's ability to delete or alter.

When deletion is requested, CNH may:
- Delete or restrict off-chain personal data where feasible.
- Revoke or invalidate provider/admin wallet bindings where appropriate.
- Retain minimal audit records when needed for security, legal, fraud prevention, or dispute-resolution purposes.

## 6. Security Controls

Blockchain and wallet flows are included in CNH's NIST CSF 2.0-informed cybersecurity program:
- **Govern:** Wallet use is limited to higher-assurance workflows and role-specific access boundaries.
- **Identify:** Wallet-related assets, risks, and dependencies are tracked.
- **Protect:** Nonces, expiration times, signed messages, wallet mismatch checks, and role checks reduce misuse.
- **Detect:** Failed wallet attempts, mismatches, replay attempts, and unauthorized role attempts are logged.
- **Respond:** Suspicious wallet activity may trigger denial, session revocation, access review, or provider/admin support.
- **Recover:** Bound wallets may be reviewed or reset through secure operational processes when justified.

## 7. Third-Party Wallets and Networks

Wallet software, wallet browsers, app stores, blockchain networks, RPC providers, and bridges are third-party systems. CNH does not control their uptime, prompts, interface, fees, network status, private-key handling, or transaction finality.

Users are responsible for securing their wallet devices, private keys, seed phrases, and signed transactions.

## 8. Cross-Border Considerations

Blockchain networks may process and replicate data globally. Before launching new blockchain-based features in additional jurisdictions, CNH should review local privacy, financial, consumer-protection, digital asset, cybersecurity, sanctions, and data-transfer requirements.

## 9. Incident Reporting

Users should report suspected wallet compromise, suspicious signature prompts, unauthorized wallet binding, wrong-wallet denial, or provider/admin access concerns through platform support.

This policy is a launch-readiness document and should be reviewed by qualified legal, blockchain, privacy, and security counsel before broader international activation of blockchain-dependent workflows.
