import React from 'react';

const ProviderWalletGuide: React.FC = () => (
  <section className="rounded-2xl border border-blue-200/20 bg-blue-400/5 p-5 text-sm leading-6 text-slate-200">
    <h2 className="text-lg font-bold text-white">Your wallet: the next step after approval</h2>
    <p className="mt-3">A wallet is an app that holds the keys used to prove control of your wallet address. CNH links that address to your approved provider account. Your password signs you into the account; wallet verification adds proof that you control the linked wallet before provider tools open.</p>
    <ol className="mt-4 list-decimal space-y-3 pl-5">
      <li><strong>Create or choose your wallet.</strong> If you already have a compatible wallet you control, you can use it. Otherwise, install MetaMask through its official website and follow its setup and backup instructions. CNH never creates or holds your wallet keys.</li>
      <li><strong>Protect your recovery method.</strong> Follow the wallet's recovery instructions and keep any Secret Recovery Phrase or private key private. Never paste these into CNH, an application response, email, or a support chat. A CNH password reset does not recover a lost wallet.</li>
      <li><strong>Connect and bind after approval.</strong> Return to Provider Access, sign in with your application email and password, and choose Bind Wallet when prompted. Check the selected account carefully: it becomes your approved provider wallet.</li>
      <li><strong>Read the message before signing.</strong> Confirm you are on conscious-network.org and the message describes CNH provider wallet binding or sign-in. These CNH authentication messages require no gas or payment and do not authorize a blockchain transaction. Reject requests to transfer funds, approve token spending, or sign an unrelated message.</li>
      <li><strong>Verify to open provider tools.</strong> Use the bound wallet for verification. On mobile, return to the same browser tab after approving in the wallet. If you lose access or need to change wallets, contact CNH support for account review.</li>
    </ol>
    <p className="mt-4">This check makes a stolen account password alone insufficient to open provider tools. It does not prevent every scam: a harmful signature can still grant permissions. Your wallet address is public, and activity associated with it may be visible on the blockchain. CNH sign-in itself does not publish your application documents on-chain.</p>
    <p className="mt-4 flex flex-wrap gap-3">
      <a className="underline" href="https://metamask.io/download" target="_blank" rel="noreferrer">Official MetaMask download</a>
      <a className="underline" href="https://support.metamask.io/start/user-guide-secret-recovery-phrase-password-and-private-keys" target="_blank" rel="noreferrer">Wallet recovery and security</a>
      <a className="underline" href="https://ethereum.org/wallets/" target="_blank" rel="noreferrer">What a wallet does</a>
    </p>
  </section>
);
export default ProviderWalletGuide;
