import React, { useEffect, useState } from 'react';
import { Download, Mail, RefreshCw, Send } from 'lucide-react';
import { api, getBackendBaseUrl } from '../services/apiClient';
import { getAuthToken } from '../services/sessionService';

interface Correspondence {
  id: string; threadId: string; subject: string; message: string; createdAt: string;
  sender: { id: string | null; name: string }; recipient: { id: string; name: string };
  sent: boolean; read: boolean; canReply: boolean;
  attachments: Array<{ id: string; name: string; size: number; mimeType: string }>;
}
interface Recipient { id: string; name: string; email?: string; role: string; providerApprovalStatus?: string | null }
const sample: Correspondence = {
  id: 'sample', threadId: 'sample', subject: 'Welcome to your HCN correspondence',
  message: 'Your reviewer can send updates and documents here. You can reply, ask about your next step, and keep a copy of your correspondence. Your history stays with your account after approval.',
  createdAt: '2026-09-06T12:00:00Z', sender: { id: null, name: 'HCN Administration' },
  recipient: { id: 'sample-applicant', name: 'Preview Applicant' }, sent: false, read: false, canReply: true, attachments: [],
};
const button = 'rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10 disabled:opacity-50';
const field = 'mt-2 w-full min-w-0 rounded-xl border border-white/15 bg-slate-950 p-3 text-white';
const messageError = (error: unknown) => error instanceof Error ? error.message : 'Unable to complete this action. Please try again.';

export default function Mailbox({ admin = false, preview = false, onBack }: { admin?: boolean; preview?: boolean; onBack?: () => void }) {
  const [messages, setMessages] = useState<Correspondence[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [folder, setFolder] = useState<'Inbox' | 'Sent' | 'History'>('Inbox');
  const [selected, setSelected] = useState<Correspondence | null>(null);
  const [thread, setThread] = useState<Correspondence[]>([]);
  const [composing, setComposing] = useState(false);
  const [replyTo, setReplyTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [fileKey, setFileKey] = useState(0);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientId, setRecipientId] = useState(admin ? '' : 'administration');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async (next?: string) => {
    if (preview) { setMessages([sample]); return; }
    setLoading(true); setError('');
    try {
      const data = await api<{ messages: Correspondence[]; nextCursor: string | null }>(`/mail/messages${next ? `?cursor=${encodeURIComponent(next)}` : ''}`, { cache: 'no-store' });
      setMessages(current => next ? [...current, ...data.messages.filter(m => !current.some(old => old.id === m.id))] : data.messages);
      setCursor(data.nextCursor);
    } catch (err) { setError(messageError(err)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [preview]);
  useEffect(() => {
    if (!composing || replyTo || preview) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void api<{ recipients: Recipient[] }>(`/mail/recipients?search=${encodeURIComponent(search)}`)
        .then(data => { if (active) setRecipients(data.recipients); })
        .catch(err => { if (active) setError(messageError(err)); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [composing, search, replyTo, preview]);
  useEffect(() => {
    if (!selected) { setThread([]); return; }
    if (preview) { setThread([sample]); return; }
    let active = true;
    setThread([]); setError('');
    void api<{ messages: Correspondence[] }>(`/mail/messages/${encodeURIComponent(selected.id)}/thread`)
      .then(async data => {
        if (!active) return;
        setThread(data.messages);
        const results = await Promise.allSettled(data.messages.filter(m => !m.read && !m.sent).map(m =>
          api(`/mail/messages/${encodeURIComponent(m.id)}/read`, { method: 'PATCH', body: { read: true } })));
        if (!active) return;
        if (results.some(result => result.status === 'rejected')) setError('The thread opened, but its read state could not be saved. Refresh to try again.');
        else setMessages(current => current.map(m => data.messages.some(t => t.id === m.id) ? { ...m, read: true } : m));
      }).catch(err => { if (active) setError(messageError(err)); });
    return () => { active = false; };
  }, [selected?.id, preview]);

  const download = async (path: string, filename: string) => {
    if (preview) return;
    setError(''); setBusy(true);
    try {
      const token = getAuthToken();
      const response = await fetch(`${getBackendBaseUrl()}/api/mail${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include', cache: 'no-store',
      });
      if (!response.ok) throw new Error('Download unavailable. Refresh your mailbox and try again.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = filename;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setError(messageError(err)); }
    finally { setBusy(false); }
  };
  const compose = (reply?: Correspondence) => {
    if (body.trim() && !window.confirm('Discard your current unsent draft?')) return;
    setReplyTo(reply?.id || ''); setSubject(reply?.subject || ''); setBody(''); setFiles([]); setFileKey(key => key + 1);
    setRecipientId(admin ? '' : 'administration'); setSearch(''); setComposing(true); setNotice('');
  };
  const send = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy || preview) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (files.length > 3 || files.some(file => file.size > 5 * 1024 * 1024)) throw new Error('Choose up to three files, no larger than 5 MB each.');
      const data = new FormData(); data.set('subject', subject.trim()); data.set('message', body.trim());
      if (replyTo) data.set('replyTo', replyTo); else data.set('recipientId', recipientId);
      files.forEach(file => data.append('attachments', file));
      const result = await api<{ id: string }>('/mail/messages', { method: 'POST', body: data });
      setBody(''); setFiles([]); setComposing(false); setNotice('Delivered to the HCN mailbox.');
      setSelected(null); setFolder('Sent'); await load();
      const sent = await api<{ messages: Correspondence[] }>(`/mail/messages/${encodeURIComponent(result.id)}/thread`);
      setSelected(sent.messages.find(m => m.id === result.id) || null);
    } catch (err) { setError(`${messageError(err)} Check Sent before retrying if the connection was interrupted.`); }
    finally { setBusy(false); }
  };
  const visible = messages.filter(m => folder === 'History' || (folder === 'Sent' ? m.sent : !m.sent));
  const threads = visible.filter((m, index) => visible.findIndex(other => other.threadId === m.threadId) === index);

  return <section aria-label="HCN correspondence" className="min-w-0 rounded-3xl border border-white/10 bg-[#100f0a] p-4 text-white sm:p-6">
    {onBack && <button className={button} onClick={onBack}>Back</button>}
    <header className="my-4 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-2xl font-bold"><Mail className="h-6 w-6 text-amber-100" />HCN Mailbox</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{admin ? 'Correspondence with applicants, providers, and members. Approval and account controls remain in your administration tools.' : 'Your private correspondence with HCN Administration. Updates and replies stay with your account.'}</p></div>
      <div className="flex flex-wrap gap-2"><button className={button} disabled={busy || loading} onClick={() => void load()}><RefreshCw className="mr-2 inline h-4 w-4" />Refresh</button>
        <button className={button} disabled={busy || preview} onClick={() => compose()}>New message</button></div>
    </header>
    {preview && <p className="mb-4 rounded-xl bg-amber-400/10 p-3 text-sm text-amber-100">Read-only applicant preview. Sample correspondence; sending and downloads are disabled.</p>}
    {error && <p role="alert" className="my-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-100">{error}</p>}
    {notice && <p role="status" className="my-3 text-sm text-amber-100">{notice}</p>}
    <nav aria-label="Mailbox folders" className="mb-4 flex flex-wrap gap-2">{(['Inbox', 'Sent', 'History'] as const).map(name =>
      <button key={name} aria-pressed={folder === name} className={`${button} ${folder === name ? 'border-amber-200/70 bg-amber-400/10' : ''}`} onClick={() => setFolder(name)}>{name}</button>)}</nav>
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.4fr)]">
      <div className="min-w-0 space-y-2">
        {loading && <p role="status" className="p-3 text-sm text-slate-300">Loading correspondence…</p>}
        {!loading && !threads.length && <p className="p-3 text-sm text-slate-300">No correspondence in this folder{cursor ? ' among the loaded messages. Load earlier correspondence below' : ''}.</p>}
        {threads.map(m => <button key={m.threadId} onClick={() => {
          if (composing && body.trim() && !window.confirm('Discard your current unsent draft?')) return;
          setComposing(false); setBody(''); setSelected(m);
        }} aria-pressed={selected?.threadId === m.threadId}
          className={`w-full min-w-0 rounded-2xl border p-4 text-left ${selected?.threadId === m.threadId ? 'border-amber-200/60 bg-amber-400/10' : 'border-white/10 bg-white/[0.04]'}`}>
          <span className="block break-words text-xs text-slate-300">{m.sent ? `To: ${m.recipient.name}` : `From: ${m.sender.name}`}</span>
          <span className="mt-2 block break-words font-bold">{m.subject}</span>
          <time className="mt-2 block text-xs text-slate-400">{new Date(m.createdAt).toLocaleString()}</time>
          {!m.sent && visible.some(t => t.threadId === m.threadId && !t.read) && <span className="mt-2 inline-block text-xs font-bold text-amber-100">Unread</span>}
          {!!m.attachments.length && <span className="mt-2 block text-xs text-slate-300">{m.attachments.length} attachment(s)</span>}
        </button>)}
        {cursor && <button className={button} disabled={loading} onClick={() => void load(cursor)}>Load earlier correspondence</button>}
      </div>
      <div className="min-w-0 space-y-4">
        {selected && <div className="flex flex-wrap gap-2">
          <button className={button} disabled={busy || preview || !thread.length} onClick={() => void download(`/messages/${encodeURIComponent(selected.id)}/export`, 'HCN-correspondence.txt')}><Download className="mr-2 inline h-4 w-4" />Download thread</button>
          <button className={button} disabled={busy || preview || !selected.canReply} onClick={() => compose(selected)}>Reply</button>
          {!selected.sent && <button className={button} disabled={busy || preview} onClick={() => {
            setBusy(true);
            void api(`/mail/messages/${encodeURIComponent(selected.id)}/read`, { method: 'PATCH', body: { read: false } })
              .then(() => { setSelected(null); return load(); }).catch(err => setError(messageError(err))).finally(() => setBusy(false));
          }}>Mark unread</button>}
        </div>}
        {selected && !selected.canReply && <p className="text-sm text-slate-300">This visitor has no authenticated mailbox. Follow up using your established contact process; their submitted email does not establish an account identity.</p>}
        {thread.map(m => <article key={m.id} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
          <h3 className="break-words text-lg font-bold">{m.subject}</h3>
          <p className="mt-2 break-words text-sm text-slate-300">From: {m.sender.name}<br />To: {m.recipient.name}</p>
          <time className="mt-2 block text-xs text-slate-400">{new Date(m.createdAt).toLocaleString()}</time>
          <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-100">{m.message}</p>
          {m.attachments.map(a => <button key={a.id} className={`${button} mt-3 block max-w-full break-all text-left`} disabled={busy || preview}
            onClick={() => void download(`/messages/${encodeURIComponent(m.id)}/attachments/${encodeURIComponent(a.id)}`, a.name)}>
            <Download className="mr-2 inline h-4 w-4" />{a.name} · {Math.ceil(a.size / 1024)} KB</button>)}
        </article>)}
        {!selected && !composing && <p className="p-5 text-sm text-slate-300">Open a message to read its thread, reply, or download a copy.</p>}
        {composing && <form onSubmit={send} className="space-y-4 rounded-2xl border border-amber-200/20 p-4">
          <h3 className="text-lg font-bold">{replyTo ? 'Reply to correspondence' : 'New correspondence'}</h3>
          {!replyTo && <>
            {admin && <label className="block text-sm">Find a recipient by name or email<input value={search} onChange={event => { setSearch(event.target.value); setRecipientId(''); }} className={field} maxLength={200} /></label>}
            <label className="block text-sm">To<select className={field} required value={recipientId} onChange={event => setRecipientId(event.target.value)} disabled={busy}>
              {admin && <option value="">Select a recipient</option>}
              {recipients.map(r => <option key={r.id} value={r.id}>{r.name}{admin ? ` · ${r.email} · ${r.role}${r.providerApprovalStatus ? ` (${r.providerApprovalStatus})` : ''}` : ''}</option>)}
            </select></label>
          </>}
          <label className="block text-sm">Subject<input className={field} required maxLength={240} value={subject} onChange={event => setSubject(event.target.value)} disabled={busy || !!replyTo} /></label>
          <label className="block text-sm">Message<textarea className={field} rows={6} required maxLength={8000} value={body} onChange={event => setBody(event.target.value)} disabled={busy} /></label>
          <label className="block text-sm">Attachments<input key={fileKey} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.txt" disabled={busy} className="mt-2 block w-full text-sm" onChange={event => setFiles(Array.from(event.target.files || []))} /></label>
          <p className="text-xs leading-5 text-slate-300">Up to three PDF, PNG, JPEG, or text files, 5 MB each. Send only relevant information. Never send passwords, wallet recovery phrases, or payment-card details. Your draft remains on this page until sent; leaving the page discards it.</p>
          <button className={button} disabled={busy || preview || (!replyTo && !recipientId)} type="submit"><Send className="mr-2 inline h-4 w-4" />{busy ? 'Sending…' : 'Send correspondence'}</button>
        </form>}
      </div>
    </div>
  </section>;
}
