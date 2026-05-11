import { Router, Request, Response, NextFunction } from 'express';
import multer, { MulterError } from 'multer';
import {
  computePasswordFingerprint,
  createSessionToken,
  hashPassword,
} from '../auth';
import {
  getAuthenticatedRole,
  getAuthenticatedUserId,
  requireCanonicalIdentity,
} from '../middleware';
import { recordAuditEvent } from '../services/auditTelemetry';
import { localStore } from '../services/persistenceStore';
import { createUserSession } from '../services/userSessionStore';
import { persistUploadObject } from '../services/uploadBlobStore';
import {
  ProviderApplicantFileRef,
  createProviderApplicant,
  getProviderApplicantByUserId,
  updateProviderApplicantReview,
} from '../services/providerApplicantStore';

export const PROVIDER_APPLICANT_CALENDLY_URL =
  'https://calendly.com/randycofield/buildingconnections';

const publicRouter = Router();
const protectedRouter = Router();
protectedRouter.use(requireCanonicalIdentity);

const MIN_PASSWORD_LENGTH = 12;
const MAX_APPLICATION_UPLOAD_BYTES = 15 * 1024 * 1024;
const ACCEPTED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/rtf',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_APPLICATION_UPLOAD_BYTES, files: 2 },
});

type ApplicantApplyRequest = Request & {
  files?: {
    resume?: Express.Multer.File[];
    coverLetter?: Express.Multer.File[];
  };
};

const getPublicBaseUrl = (req: Request): string => {
  const configured = process.env.PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim();
  const proto = forwardedProto || req.protocol || 'https';
  return `${proto}://${req.get('host')}`;
};

const text = (value: unknown): string => String(value || '').trim();

const nullableText = (value: unknown): string | null => {
  const valueText = text(value);
  return valueText || null;
};

const parseJsonField = (value: unknown): unknown | null => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return value;
  const normalized = value.trim();
  if (!normalized) return null;
  try {
    return JSON.parse(normalized);
  } catch {
    return null;
  }
};

const parseListField = (value: unknown): string[] => {
  const parsed = parseJsonField(value);
  if (Array.isArray(parsed)) {
    return parsed.map((entry) => text(entry)).filter(Boolean);
  }
  const raw = text(value);
  if (!raw) return [];
  return raw
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const parseOptionalDate = (value: unknown): Date | null => {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseOptionalInt = (value: unknown): number | null => {
  const parsed = Number(text(value));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
};

const isTruthy = (value: unknown): boolean => {
  const normalized = text(value).toLowerCase();
  return ['1', 'true', 'yes', 'on', 'agree', 'agreed'].includes(normalized);
};

const validatePasswordPolicy = (email: string, password: string): string | null => {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter.';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.';
  if (!/\d/.test(password)) return 'Password must include at least one number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include at least one symbol.';

  const fragments = email
    .toLowerCase()
    .split(/[@._-]+/)
    .filter((fragment) => fragment.length >= 3);
  const loweredPassword = password.toLowerCase();
  if (fragments.some((fragment) => loweredPassword.includes(fragment))) {
    return 'Password must not include parts of your email address.';
  }
  return null;
};

const buildPublicUser = (user: any) => ({
  id: user.id,
  email: user.email,
  name: user.name || null,
  role: user.role || 'applicant',
  tier: user.tier || '',
  membershipStatus: user.membershipStatus || null,
  subscriptionStatus: user.subscriptionStatus || 'inactive',
  hasActiveMembership: false,
  createdAt: user.createdAt,
});

const assertDocumentFile = (file: Express.Multer.File | undefined, label: string): string | null => {
  if (!file) return `${label} is required.`;
  const mimeType = text(file.mimetype).toLowerCase();
  if (!ACCEPTED_DOCUMENT_MIME_TYPES.has(mimeType)) {
    return `${label} must be a PDF, DOC, DOCX, RTF, or TXT document.`;
  }
  return null;
};

const persistApplicantDocument = async (
  req: Request,
  userId: string,
  file: Express.Multer.File
): Promise<ProviderApplicantFileRef> => {
  const persisted = await persistUploadObject({
    userId,
    mimeType: file.mimetype,
    originalName: file.originalname,
    buffer: file.buffer,
  });
  return {
    originalName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    storageProvider: persisted.storageProvider,
    objectKey: persisted.objectKey,
    url: `${getPublicBaseUrl(req)}${persisted.publicPath}`,
  };
};

publicRouter.post(
  '/apply',
  upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'coverLetter', maxCount: 1 },
  ]),
  async (req: Request, res: Response): Promise<void> => {
    const mReq = req as ApplicantApplyRequest;
    const email = text(req.body?.email).toLowerCase();
    const password = String(req.body?.password || '');
    const confirmPassword = String(req.body?.confirmPassword || '');
    const firstName = text(req.body?.firstName);
    const lastName = text(req.body?.lastName);
    const providerCategory = text(req.body?.providerCategory);
    const phone = text(req.body?.phone);
    const resume = mReq.files?.resume?.[0];
    const coverLetter = mReq.files?.coverLetter?.[0];

    const auditApply = (
      outcome: 'success' | 'deny' | 'error',
      statusCode: number,
      reason: string,
      actorUserId?: string | null
    ): void => {
      recordAuditEvent(req, {
        domain: 'profile',
        action: 'provider_applicant_apply',
        outcome,
        actorUserId: actorUserId || null,
        statusCode,
        metadata: { reason, emailProvided: Boolean(email), providerCategory },
      });
    };

    if (!firstName || !lastName || !email || !phone || !providerCategory) {
      auditApply('deny', 400, 'missing_required_identity_fields');
      res.status(400).json({
        error: 'First name, last name, email, phone, and provider category are required.',
      });
      return;
    }
    if (password !== confirmPassword) {
      auditApply('deny', 400, 'password_mismatch');
      res.status(400).json({ error: 'Passwords do not match.' });
      return;
    }

    const passwordPolicyError = validatePasswordPolicy(email, password);
    if (passwordPolicyError) {
      auditApply('deny', 400, 'password_policy_rejected');
      res.status(400).json({ error: passwordPolicyError });
      return;
    }

    const resumeError = assertDocumentFile(resume, 'Resume');
    const coverLetterError = assertDocumentFile(coverLetter, 'Cover letter');
    if (resumeError || coverLetterError || !resume || !coverLetter) {
      auditApply('deny', 400, 'missing_or_invalid_documents');
      res.status(400).json({ error: resumeError || coverLetterError || 'Required documents are missing.' });
      return;
    }

    const consents = {
      accurateInformation: isTruthy(req.body?.accurateInformation),
      credentialReview: isTruthy(req.body?.credentialReview),
      providerStandards: isTruthy(req.body?.providerStandards),
      approvalNotAutomatic: isTruthy(req.body?.approvalNotAutomatic),
      contactConsent: isTruthy(req.body?.contactConsent),
    };
    if (!Object.values(consents).every(Boolean)) {
      auditApply('deny', 400, 'consents_missing');
      res.status(400).json({ error: 'All integrity and consent acknowledgments are required.' });
      return;
    }

    try {
      const existingUser = await localStore.getUserByEmail(email);
      if (existingUser) {
        auditApply('deny', 409, 'duplicate_email', existingUser.id);
        res.status(409).json({ error: 'An account already exists for this email.' });
        return;
      }

      const passwordFingerprint = computePasswordFingerprint(password);
      const reusedPasswordUser = await localStore.findUserByPasswordFingerprint(passwordFingerprint);
      if (reusedPasswordUser) {
        auditApply('deny', 400, 'password_fingerprint_reused');
        res.status(400).json({
          error: 'Choose a unique password that is not already used by another profile.',
        });
        return;
      }

      const user = await localStore.createUser({
        email,
        name: `${firstName} ${lastName}`.trim(),
        role: 'applicant',
        password: hashPassword(password),
        passwordFingerprint,
        tier: '',
        phoneNumber: phone,
        twoFactorMethod: 'none',
      });

      const resumeFile = await persistApplicantDocument(req, user.id, resume);
      const coverLetterFile = await persistApplicantDocument(req, user.id, coverLetter);
      const alignmentAnswers =
        (parseJsonField(req.body?.alignmentAnswers) as Record<string, string> | null) || {
          consciousService: text(req.body?.consciousService),
          ethicalResponsibility: text(req.body?.ethicalResponsibility),
          marginalizedCommunities: text(req.body?.marginalizedCommunities),
          worldviewDiversity: text(req.body?.worldviewDiversity),
          whyHigherConsciousNetwork: text(req.body?.whyHigherConsciousNetwork),
          transformationSupport: text(req.body?.transformationSupport),
        };

      const applicant = await createProviderApplicant({
        userId: user.id,
        email,
        firstName,
        lastName,
        phone,
        communicationPreference: nullableText(req.body?.communicationPreference),
        providerCategory,
        organizationName: nullableText(req.body?.organizationName),
        professionalTitle: nullableText(req.body?.professionalTitle),
        website: nullableText(req.body?.website),
        socialLinks: parseListField(req.body?.socialLinks),
        serviceArea: nullableText(req.body?.serviceArea),
        availabilityMode: nullableText(req.body?.availabilityMode),
        servicesOffered: parseListField(req.body?.servicesOffered),
        targetAudience: nullableText(req.body?.targetAudience),
        populationsServed: parseListField(req.body?.populationsServed),
        experienceLevel: nullableText(req.body?.experienceLevel),
        yearsExperience: parseOptionalInt(req.body?.yearsExperience),
        practiceStatus: nullableText(req.body?.practiceStatus),
        availabilityToServe: nullableText(req.body?.availabilityToServe),
        credentialsText: nullableText(req.body?.credentialsText),
        licenseNumber: nullableText(req.body?.licenseNumber),
        issuingOrganization: nullableText(req.body?.issuingOrganization),
        credentialExpiration: parseOptionalDate(req.body?.credentialExpiration),
        professionalReferences: nullableText(req.body?.professionalReferences),
        resumeFile,
        coverLetterFile,
        alignmentAnswers,
        integrityConsents: consents,
        status: 'submitted',
        calendlyShownAt: new Date(),
      });

      const persistedSession = await createUserSession(user.id);
      const session = createSessionToken(user.id, {
        sessionId: persistedSession.id,
        expiresAt: persistedSession.expiresAt.getTime(),
      });

      auditApply('success', 201, 'application_submitted', user.id);
      res.status(201).json({
        success: true,
        token: session.token,
        expiresAt: session.expiresAt,
        user: buildPublicUser(user),
        applicant,
        calendlyUrl: PROVIDER_APPLICANT_CALENDLY_URL,
      });
    } catch (error) {
      const duplicateCode = (error as Error & { code?: string })?.code;
      if (duplicateCode === 'DUPLICATE_USER' || duplicateCode === 'P2002') {
        auditApply('deny', 409, 'duplicate_user_or_application');
        res.status(409).json({ error: 'An applicant account already exists for this email.' });
        return;
      }
      console.error('[PROVIDER_APPLICANTS][ERROR] Failed to submit application', error);
      auditApply('error', 500, 'application_submit_failed');
      res.status(500).json({ error: 'Failed to submit provider application.' });
    }
  }
);

protectedRouter.get('/current', async (req: Request, res: Response): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  const role = getAuthenticatedRole(req);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (role !== 'applicant' && role !== 'admin') {
    res.status(403).json({ error: 'Applicant status access only.' });
    return;
  }

  const applicant = await getProviderApplicantByUserId(userId);
  if (!applicant) {
    res.status(404).json({ error: 'Provider application not found.' });
    return;
  }
  res.json({
    success: true,
    applicant,
    calendlyUrl: PROVIDER_APPLICANT_CALENDLY_URL,
  });
});

protectedRouter.post('/current/calendly-shown', async (req: Request, res: Response): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  const role = getAuthenticatedRole(req);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (role !== 'applicant' && role !== 'admin') {
    res.status(403).json({ error: 'Applicant status access only.' });
    return;
  }

  const applicant = await getProviderApplicantByUserId(userId);
  if (!applicant) {
    res.status(404).json({ error: 'Provider application not found.' });
    return;
  }

  const updated = await updateProviderApplicantReview(applicant.id, {
    calendlyShownAt: applicant.calendlyShownAt || new Date(),
  });
  res.json({
    success: true,
    applicant: updated,
    calendlyUrl: PROVIDER_APPLICANT_CALENDLY_URL,
  });
});

const handleUploadMiddlewareError = (
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({
      error: `Uploaded file exceeds maximum size of ${MAX_APPLICATION_UPLOAD_BYTES} bytes.`,
    });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  next(err);
};

publicRouter.use(handleUploadMiddlewareError);
protectedRouter.use(handleUploadMiddlewareError);

export {
  publicRouter as providerApplicantPublicRoutes,
  protectedRouter as providerApplicantProtectedRoutes,
};
