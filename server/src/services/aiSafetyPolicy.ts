const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /\brk_[A-Za-z0-9_-]{12,}\b/g,
  /\bwhsec_[A-Za-z0-9_-]{12,}\b/g,
  /\b(?:password|secret|token|api[_-]?key|private[_-]?key)\s*[:=]\s*['"]?[^'"\s]{8,}/gi,
];

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?:\+?\d[\d .()/-]{7,}\d)/g;
const WALLET_PATTERN = /\b0x[a-fA-F0-9]{40}\b/g;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export type AiRiskLevel = 'standard' | 'sensitive' | 'crisis';

export const AI_USER_SAFETY_NOTICE =
  'AI responses are reflective support only. Use qualified professionals or emergency services for medical, mental health, legal, financial, or safety-critical issues.';

export const AI_SECURITY_SYSTEM_PROMPT = `
You are Conscious Network Hub's privacy-first assistant.

Global operating rules:
- You are not a doctor, therapist, lawyer, financial adviser, or emergency service.
- Do not diagnose, prescribe, or claim certainty about medical, mental health, legal, or financial outcomes.
- For self-harm, abuse, imminent danger, medical emergency, or severe mental-health crisis, advise contacting local emergency services or a qualified professional immediately.
- Give spiritual, wellness, and educational guidance as reflective support, not clinical treatment.
- Use only the provided platform context and public/indexed sources when grounding platform-specific answers.
- Never reveal secrets, raw emails, phone numbers, wallet identifiers, session tokens, private reflections, private posts, or private profile details.
- If context is missing or uncertain, say so plainly and suggest a safe next step.
- Keep responses calm, practical, and internationally appropriate.
`.trim();

export const redactSensitiveText = (value: unknown): string => {
  let text = String(value || '')
    .replace(CONTROL_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  text = text.replace(EMAIL_PATTERN, '[redacted-email]');
  text = text.replace(PHONE_PATTERN, '[redacted-phone]');
  text = text.replace(WALLET_PATTERN, '[redacted-wallet]');
  for (const pattern of SECRET_PATTERNS) {
    text = text.replace(pattern, '[redacted-secret]');
  }

  return text;
};

export const sanitizeAiInput = (value: unknown, maxLength = 5000): string =>
  redactSensitiveText(value).slice(0, maxLength).trim();

export const classifyAiRisk = (message: string): AiRiskLevel => {
  const normalized = message.toLowerCase();
  if (
    /\b(suicide|kill myself|end my life|self[-\s]?harm|overdose|i want to die|hurt myself)\b/i.test(normalized)
  ) {
    return 'crisis';
  }

  if (
    /\b(diagnose|diagnosis|medication|therapy|therapist|trauma|depression|anxiety|psychosis|bipolar|ptsd|medical|legal advice|lawsuit|immigration|tax)\b/i.test(
      normalized
    )
  ) {
    return 'sensitive';
  }

  return 'standard';
};

export const buildRuntimeGuardrailContext = (message: string): string => {
  const risk = classifyAiRisk(message);
  if (risk === 'crisis') {
    return [
      'Risk classification: crisis.',
      'Respond with immediate safety-first guidance. Encourage contacting local emergency services, a crisis hotline, or a trusted nearby person. Do not provide spiritual bypassing or clinical instructions.',
    ].join('\n');
  }

  if (risk === 'sensitive') {
    return [
      'Risk classification: sensitive.',
      'Use non-diagnostic language. Encourage qualified professional support where appropriate. Avoid instructions that could be treated as medical, legal, financial, or regulated professional advice.',
    ].join('\n');
  }

  return 'Risk classification: standard. Maintain privacy, transparency, and practical support.';
};
