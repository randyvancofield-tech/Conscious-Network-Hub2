import type { EmailOptions } from './emailService';

type ProviderApplicantStatus =
  | 'submitted'
  | 'under_review'
  | 'discovery_scheduled'
  | 'approved'
  | 'rejected'
  | 'needs_more_info';

interface ProviderApplicantEmailContext {
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  providerCategory?: string | null;
  status?: ProviderApplicantStatus | string | null;
  frontendBaseUrl: string;
  applicantPortalUrl: string;
  providerAccessUrl: string;
  calendlyUrl?: string | null;
  applicantMessage?: string | null;
}

interface AdminProviderApplicationContext {
  adminEmail: string;
  applicantName: string;
  applicantEmail: string;
  providerCategory?: string | null;
  status?: string | null;
  submittedAt?: Date | string | null;
}

interface PasswordResetContext {
  resetUrl: string;
  expiresMinutes: number;
}

export const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return map[char];
  });

const normalizeStatusLabel = (status: unknown): string => {
  const normalized = String(status || '').trim().toLowerCase();
  const labels: Record<string, string> = {
    submitted: 'Submitted',
    under_review: 'Under review',
    discovery_scheduled: 'Discovery scheduled',
    approved: 'Approved',
    rejected: 'Not approved',
    needs_more_info: 'More information requested',
  };
  return labels[normalized] || 'Updated';
};

const nameForApplicant = (context: Pick<ProviderApplicantEmailContext, 'firstName' | 'email'>): string =>
  String(context.firstName || '').trim() || String(context.email || '').split('@')[0] || 'there';

const paragraph = (value: unknown): string => {
  const escaped = escapeHtml(value).replace(/\n/g, '<br/>');
  return escaped ? `<p>${escaped}</p>` : '';
};

const shell = (title: string, body: string): string => `
  <div style="font-family:Arial,sans-serif;line-height:1.55;color:#172033">
    <h2>${escapeHtml(title)}</h2>
    ${body}
    <hr/>
    <p style="font-size:12px;color:#536173">Conscious Network Hub</p>
  </div>
`;

export const buildPasswordResetEmail = (context: PasswordResetContext): Omit<EmailOptions, 'to'> => {
  const safeResetUrl = escapeHtml(context.resetUrl);
  const text = [
    'We received a request to reset your Conscious Network Hub password.',
    `Open this link within ${context.expiresMinutes} minutes: ${context.resetUrl}`,
    'If you did not request this, you can ignore this email.',
  ].join('\n\n');

  return {
    subject: 'Reset your Conscious Network Hub password',
    text,
    html: shell(
      'Reset your Conscious Network Hub password',
      [
        '<p>We received a request to reset your Conscious Network Hub password.</p>',
        `<p><a href="${safeResetUrl}">Reset your password</a></p>`,
        `<p>This link expires in ${context.expiresMinutes} minutes. If you did not request this, you can ignore this email.</p>`,
      ].join('')
    ),
  };
};

export const buildProviderApplicationSubmittedEmail = (
  context: ProviderApplicantEmailContext
): Omit<EmailOptions, 'to'> => {
  const name = nameForApplicant(context);
  const portalUrl = escapeHtml(context.applicantPortalUrl);
  const calendlyUrl = context.calendlyUrl ? escapeHtml(context.calendlyUrl) : null;
  const category = String(context.providerCategory || '').trim();
  const textParts = [
    `Hi ${name},`,
    'We received your Conscious Network Hub provider application.',
    category ? `Provider category: ${category}` : '',
    'Your applicant portal shows the current review status. Approval is not automatic, and the review team may request more information.',
    `Applicant portal: ${context.applicantPortalUrl}`,
    context.calendlyUrl ? `Discovery scheduling: ${context.calendlyUrl}` : '',
    'Please do not send private documents by email unless the review team explicitly provides a secure process.',
  ].filter(Boolean);

  return {
    subject: 'Provider application received',
    text: textParts.join('\n\n'),
    html: shell(
      'Provider application received',
      [
        `<p>Hi ${escapeHtml(name)},</p>`,
        '<p>We received your Conscious Network Hub provider application.</p>',
        category ? `<p><strong>Provider category:</strong> ${escapeHtml(category)}</p>` : '',
        '<p>Your applicant portal shows the current review status. Approval is not automatic, and the review team may request more information.</p>',
        `<p><a href="${portalUrl}">Open the applicant portal</a></p>`,
        calendlyUrl ? `<p><a href="${calendlyUrl}">Schedule a discovery conversation</a></p>` : '',
        '<p>Please do not send private documents by email unless the review team explicitly provides a secure process.</p>',
      ].join('')
    ),
  };
};

export const buildProviderApplicantStatusEmail = (
  context: ProviderApplicantEmailContext
): Omit<EmailOptions, 'to'> => {
  const name = nameForApplicant(context);
  const status = String(context.status || '').trim().toLowerCase();
  const statusLabel = normalizeStatusLabel(status);
  const portalUrl = escapeHtml(context.applicantPortalUrl);
  const providerAccessUrl = escapeHtml(context.providerAccessUrl);
  const calendlyUrl = context.calendlyUrl ? escapeHtml(context.calendlyUrl) : null;
  const applicantMessage = String(context.applicantMessage || '').trim();

  let title = 'Provider application status updated';
  const nextSteps: string[] = [
    `Open the applicant portal for your current status: ${context.applicantPortalUrl}`,
  ];

  if (status === 'approved') {
    title = 'Provider application approved';
    nextSteps.push(
      `Sign in through Provider Access: ${context.providerAccessUrl}`,
      'After email/password sign-in, complete the gasless wallet verification step before provider CRM tools open.'
    );
  } else if (status === 'needs_more_info') {
    title = 'More information requested for your provider application';
    nextSteps.push(
      'The review team needs additional context before making a decision.',
      'Please do not send private documents by email unless the review team explicitly provides a secure process.'
    );
  } else if (status === 'discovery_scheduled') {
    title = 'Provider application discovery step';
    if (context.calendlyUrl) {
      nextSteps.push(`Discovery scheduling link: ${context.calendlyUrl}`);
    }
  } else if (status === 'rejected') {
    title = 'Provider application review update';
    nextSteps.push(
      'We are not able to approve the application at this time. This message does not affect any standard member account access you may have.'
    );
  }

  const text = [
    `Hi ${name},`,
    `Your provider application status is now: ${statusLabel}.`,
    applicantMessage,
    ...nextSteps,
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    subject: title,
    text,
    html: shell(
      title,
      [
        `<p>Hi ${escapeHtml(name)},</p>`,
        `<p>Your provider application status is now: <strong>${escapeHtml(statusLabel)}</strong>.</p>`,
        paragraph(applicantMessage),
        `<p><a href="${portalUrl}">Open the applicant portal</a></p>`,
        status === 'approved'
          ? `<p><a href="${providerAccessUrl}">Sign in through Provider Access</a></p><p>After email/password sign-in, complete the gasless wallet verification step before provider CRM tools open.</p>`
          : '',
        status === 'needs_more_info'
          ? '<p>The review team needs additional context before making a decision. Please do not send private documents by email unless the review team explicitly provides a secure process.</p>'
          : '',
        status === 'discovery_scheduled' && calendlyUrl
          ? `<p><a href="${calendlyUrl}">Schedule or review your discovery conversation</a></p>`
          : '',
        status === 'rejected'
          ? '<p>We are not able to approve the application at this time. This message does not affect any standard member account access you may have.</p>'
          : '',
      ].join('')
    ),
  };
};

export const buildProviderApplicationAdminEmail = (
  context: AdminProviderApplicationContext
): EmailOptions => {
  const submittedAt =
    context.submittedAt instanceof Date
      ? context.submittedAt.toISOString()
      : String(context.submittedAt || '');
  const lines = [
    `Applicant: ${context.applicantName}`,
    `Email: ${context.applicantEmail}`,
    context.providerCategory ? `Provider category: ${context.providerCategory}` : '',
    context.status ? `Status: ${context.status}` : '',
    submittedAt ? `Submitted: ${submittedAt}` : '',
    'Sign in to Administrative Access to review documents and notes.',
  ].filter(Boolean);

  return {
    to: context.adminEmail,
    subject: 'New provider application submitted',
    text: lines.join('\n'),
    html: shell(
      'New provider application submitted',
      [
        `<p><strong>Applicant:</strong> ${escapeHtml(context.applicantName)}</p>`,
        `<p><strong>Email:</strong> ${escapeHtml(context.applicantEmail)}</p>`,
        context.providerCategory
          ? `<p><strong>Provider category:</strong> ${escapeHtml(context.providerCategory)}</p>`
          : '',
        context.status ? `<p><strong>Status:</strong> ${escapeHtml(context.status)}</p>` : '',
        submittedAt ? `<p><strong>Submitted:</strong> ${escapeHtml(submittedAt)}</p>` : '',
        '<p>Sign in to Administrative Access to review documents and notes.</p>',
      ].join('')
    ),
  };
};
