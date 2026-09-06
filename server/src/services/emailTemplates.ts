import type { EmailOptions } from './emailService';

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
