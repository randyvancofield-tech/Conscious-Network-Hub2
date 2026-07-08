import { Router, Request, Response } from 'express';
import {
  getAuthenticatedUserId,
  requireCanonicalIdentity,
} from '../middleware';
import { recordAuditEvent } from '../services/auditTelemetry';
import { createAdminMessage } from '../services/adminMessageStore';
import { createConsciousCareerGrantApplication } from '../services/consciousCareerGrantStore';
import { localStore } from '../services/persistenceStore';

const router = Router();
router.use(requireCanonicalIdentity);

const MAX_GRANT_AMOUNT_USD = 12000;
const MIN_ANSWER_LENGTH = 20;

const text = (value: unknown): string => String(value || '').trim();

const parseStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => text(entry)).filter(Boolean).slice(0, 12);
};

const parseAnswers = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const output: Record<string, string> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    const normalizedKey = text(key);
    const normalizedValue = text(entry);
    if (normalizedKey && normalizedValue) {
      output[normalizedKey] = normalizedValue.slice(0, 4000);
    }
  });
  return output;
};

router.post('/grant-applications', async (req: Request, res: Response): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const country = text(req.body?.country);
  const applicantType = text(req.body?.applicantType);
  const ventureStage = text(req.body?.ventureStage);
  const requestedAmountUsd = Math.floor(Number(req.body?.requestedAmountUsd || 0));
  const useOfFundsCategories = parseStringArray(req.body?.useOfFundsCategories);
  const answers = parseAnswers(req.body?.answers);

  const audit = (
    outcome: 'success' | 'deny' | 'error',
    statusCode: number,
    reason: string
  ): void => {
    recordAuditEvent(req, {
      domain: 'profile',
      action: 'conscious_careers_grant_apply',
      outcome,
      actorUserId: userId,
      targetUserId: userId,
      statusCode,
      metadata: {
        reason,
        countryProvided: Boolean(country),
        requestedAmountUsd,
        applicantTypeProvided: Boolean(applicantType),
      },
    });
  };

  if (!country || !applicantType || !ventureStage) {
    audit('deny', 400, 'missing_required_identity_fields');
    res.status(400).json({ error: 'Country, applicant type, and venture stage are required.' });
    return;
  }

  if (!Number.isFinite(requestedAmountUsd) || requestedAmountUsd <= 0 || requestedAmountUsd > MAX_GRANT_AMOUNT_USD) {
    audit('deny', 400, 'invalid_requested_amount');
    res.status(400).json({ error: `Grant requests must be between $1 and $${MAX_GRANT_AMOUNT_USD.toLocaleString()}.` });
    return;
  }

  if (useOfFundsCategories.length === 0) {
    audit('deny', 400, 'missing_use_of_funds');
    res.status(400).json({ error: 'Select at least one intended use of grant funds.' });
    return;
  }

  const requiredAnswerKeys = [
    'ventureSummary',
    'useOfFundsNarrative',
    'developmentFocus',
    'impactPlan',
    'cnhLearning',
    'faithValues',
    'accountabilityPlan',
  ];
  const missingAnswer = requiredAnswerKeys.find((key) => text(answers[key]).length < MIN_ANSWER_LENGTH);
  if (missingAnswer) {
    audit('deny', 400, 'missing_required_answers');
    res.status(400).json({ error: 'Please complete every grant narrative response with enough detail.' });
    return;
  }

  try {
    const application = await createConsciousCareerGrantApplication({
      userId,
      country,
      region: text(req.body?.region),
      locality: text(req.body?.locality),
      postalCode: text(req.body?.postalCode),
      legalName: text(req.body?.legalName),
      applicantType,
      ventureStage,
      requestedAmountUsd,
      useOfFunds: {
        categories: useOfFundsCategories,
        timeline: text(req.body?.fundingTimeline),
      },
      answers,
    });
    const user = await localStore.getUserById(userId);

    try {
      await createAdminMessage({
        type: 'grant_application',
        subject: `Conscious Careers Grant Application: ${application.legalName || user?.name || user?.email || application.id}`,
        message: [
          `Requested amount: $${Number(application.requestedAmountUsd || 0).toLocaleString()}`,
          `Applicant type: ${application.applicantType}`,
          `Venture stage: ${application.ventureStage}`,
          `Country: ${application.country}`,
          application.region ? `Region: ${application.region}` : null,
          application.locality ? `Locality: ${application.locality}` : null,
          '',
          'Narrative responses:',
          ...Object.entries(application.answers || {}).map(
            ([key, value]) => `${key}: ${String(value || '')}`
          ),
        ]
          .filter((line): line is string => line !== null)
          .join('\n'),
        priority: requestedAmountUsd >= 5000 ? 'high' : 'normal',
        submitterName: user?.name || application.legalName || null,
        submitterEmail: user?.email || null,
        submitterUserId: userId,
        route: '/conscious-careers/grant-application',
        category: 'conscious_careers_grant',
        source: 'conscious_careers_grant_application',
        metadata: {
          applicationId: application.id,
          status: application.status,
          requestedAmountUsd: application.requestedAmountUsd,
          useOfFunds: application.useOfFunds,
          submittedAt: application.submittedAt,
        },
      });
    } catch (messageError) {
      console.error('[CONSCIOUS_CAREERS][WARN] Grant application saved but admin inbox message failed', {
        name: messageError instanceof Error ? messageError.name : 'UnknownError',
      });
    }

    audit('success', 201, 'grant_application_submitted');
    res.status(201).json({
      success: true,
      application: {
        id: application.id,
        status: application.status,
        submittedAt: application.submittedAt,
      },
    });
  } catch (error) {
    console.error('[CONSCIOUS_CAREERS][ERROR] Failed to submit grant application', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    audit('error', 500, 'grant_application_submit_failed');
    res.status(500).json({ error: 'Failed to submit grant application.' });
  }
});

export default router;
