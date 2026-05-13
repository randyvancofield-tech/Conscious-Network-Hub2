import { getPrisma } from './prismaClient';
import {
  protectSensitiveJson,
  protectSensitiveText,
  revealSensitiveJson,
  revealSensitiveText,
} from './sensitiveDataPolicy';

export const PROVIDER_APPLICANT_STATUSES = [
  'submitted',
  'under_review',
  'discovery_scheduled',
  'approved',
  'rejected',
  'needs_more_info',
] as const;

export type ProviderApplicantStatus = (typeof PROVIDER_APPLICANT_STATUSES)[number];

export interface ProviderApplicantFileRef {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storageProvider: string;
  objectKey: string;
  url: string;
}

export interface ProviderApplicantInput {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  communicationPreference?: string | null;
  providerCategory: string;
  organizationName?: string | null;
  professionalTitle?: string | null;
  website?: string | null;
  socialLinks?: unknown;
  serviceArea?: string | null;
  availabilityMode?: string | null;
  servicesOffered?: unknown;
  targetAudience?: string | null;
  populationsServed?: unknown;
  experienceLevel?: string | null;
  yearsExperience?: number | null;
  practiceStatus?: string | null;
  availabilityToServe?: string | null;
  credentialsText?: string | null;
  licenseNumber?: string | null;
  issuingOrganization?: string | null;
  credentialExpiration?: Date | null;
  professionalReferences?: string | null;
  resumeFile: ProviderApplicantFileRef;
  coverLetterFile: ProviderApplicantFileRef;
  alignmentAnswers: Record<string, string>;
  integrityConsents: Record<string, boolean>;
  consentAudit?: Record<string, unknown>;
  status?: ProviderApplicantStatus;
  calendlyShownAt?: Date | null;
}

export interface ProviderApplicantReviewUpdate {
  status?: ProviderApplicantStatus | string;
  adminNotes?: string | null;
  calendlyShownAt?: Date | null;
  reviewedAt?: Date | null;
}

const nullableString = (value: unknown): string | null => {
  const normalized = String(value || '').trim();
  return normalized || null;
};

const normalizeStatus = (value: unknown): ProviderApplicantStatus => {
  const status = String(value || '').trim().toLowerCase();
  return PROVIDER_APPLICANT_STATUSES.includes(status as ProviderApplicantStatus)
    ? (status as ProviderApplicantStatus)
    : 'submitted';
};

const providerApplicantModel = () => (getPrisma() as any).providerApplicant;

const applicantField = (field: string): string => `providerApplicant.${field}`;

const protectApplicantText = (field: string, value: unknown): string | null =>
  protectSensitiveText(applicantField(field), nullableString(value));

const protectRequiredApplicantText = (field: string, value: unknown): string =>
  protectApplicantText(field, value) || '';

const revealApplicantText = (field: string, value: unknown): string | null =>
  revealSensitiveText(applicantField(field), nullableString(value));

const protectApplicantJson = (field: string, value: unknown): unknown =>
  protectSensitiveJson(applicantField(field), value);

const revealApplicantJson = <T = unknown>(field: string, value: unknown): T | null =>
  revealSensitiveJson<T>(applicantField(field), value);

const revealProviderApplicant = (row: any): any => {
  if (!row) return row;
  return {
    ...row,
    email: row.email,
    firstName: revealApplicantText('firstName', row.firstName) || row.firstName,
    lastName: revealApplicantText('lastName', row.lastName) || row.lastName,
    phone: revealApplicantText('phone', row.phone),
    communicationPreference: revealApplicantText(
      'communicationPreference',
      row.communicationPreference
    ),
    providerCategory:
      revealApplicantText('providerCategory', row.providerCategory) || row.providerCategory,
    organizationName: revealApplicantText('organizationName', row.organizationName),
    professionalTitle: revealApplicantText('professionalTitle', row.professionalTitle),
    website: revealApplicantText('website', row.website),
    socialLinks: revealApplicantJson('socialLinks', row.socialLinks) || [],
    serviceArea: revealApplicantText('serviceArea', row.serviceArea),
    availabilityMode: revealApplicantText('availabilityMode', row.availabilityMode),
    servicesOffered: revealApplicantJson('servicesOffered', row.servicesOffered) || [],
    targetAudience: revealApplicantText('targetAudience', row.targetAudience),
    populationsServed: revealApplicantJson('populationsServed', row.populationsServed) || [],
    experienceLevel: revealApplicantText('experienceLevel', row.experienceLevel),
    practiceStatus: revealApplicantText('practiceStatus', row.practiceStatus),
    availabilityToServe: revealApplicantText('availabilityToServe', row.availabilityToServe),
    credentialsText: revealApplicantText('credentialsText', row.credentialsText),
    licenseNumber: revealApplicantText('licenseNumber', row.licenseNumber),
    issuingOrganization: revealApplicantText('issuingOrganization', row.issuingOrganization),
    professionalReferences: revealApplicantText(
      'professionalReferences',
      row.professionalReferences
    ),
    resumeFile: revealApplicantJson('resumeFile', row.resumeFile),
    coverLetterFile: revealApplicantJson('coverLetterFile', row.coverLetterFile),
    alignmentAnswers: revealApplicantJson('alignmentAnswers', row.alignmentAnswers) || {},
    integrityConsents: revealApplicantJson('integrityConsents', row.integrityConsents) || {},
    consentAudit: revealApplicantJson('consentAudit', row.consentAudit) || null,
  };
};

export const createProviderApplicant = async (input: ProviderApplicantInput): Promise<any> => {
  const row = await providerApplicantModel().create({
    data: {
      userId: input.userId,
      email: input.email.trim().toLowerCase(),
      firstName: protectRequiredApplicantText('firstName', input.firstName),
      lastName: protectRequiredApplicantText('lastName', input.lastName),
      phone: protectApplicantText('phone', input.phone),
      communicationPreference: protectApplicantText(
        'communicationPreference',
        input.communicationPreference
      ),
      providerCategory: protectRequiredApplicantText('providerCategory', input.providerCategory),
      organizationName: protectApplicantText('organizationName', input.organizationName),
      professionalTitle: protectApplicantText('professionalTitle', input.professionalTitle),
      website: protectApplicantText('website', input.website),
      socialLinks: protectApplicantJson('socialLinks', input.socialLinks || []),
      serviceArea: protectApplicantText('serviceArea', input.serviceArea),
      availabilityMode: protectApplicantText('availabilityMode', input.availabilityMode),
      servicesOffered: protectApplicantJson('servicesOffered', input.servicesOffered || []),
      targetAudience: protectApplicantText('targetAudience', input.targetAudience),
      populationsServed: protectApplicantJson('populationsServed', input.populationsServed || []),
      experienceLevel: protectApplicantText('experienceLevel', input.experienceLevel),
      yearsExperience: input.yearsExperience ?? null,
      practiceStatus: protectApplicantText('practiceStatus', input.practiceStatus),
      availabilityToServe: protectApplicantText(
        'availabilityToServe',
        input.availabilityToServe
      ),
      credentialsText: protectApplicantText('credentialsText', input.credentialsText),
      licenseNumber: protectApplicantText('licenseNumber', input.licenseNumber),
      issuingOrganization: protectApplicantText('issuingOrganization', input.issuingOrganization),
      credentialExpiration: input.credentialExpiration || null,
      professionalReferences: protectApplicantText(
        'professionalReferences',
        input.professionalReferences
      ),
      resumeFile: protectApplicantJson('resumeFile', input.resumeFile),
      coverLetterFile: protectApplicantJson('coverLetterFile', input.coverLetterFile),
      alignmentAnswers: protectApplicantJson('alignmentAnswers', input.alignmentAnswers),
      integrityConsents: protectApplicantJson('integrityConsents', input.integrityConsents),
      consentAudit: protectApplicantJson('consentAudit', input.consentAudit || null),
      status: normalizeStatus(input.status),
      submittedAt: new Date(),
      calendlyShownAt: input.calendlyShownAt || null,
    },
    include: { user: true },
  });
  return revealProviderApplicant(row);
};

export const getProviderApplicantByUserId = async (userId: string): Promise<any | null> => {
  const normalized = String(userId || '').trim();
  if (!normalized) return null;
  const row = await providerApplicantModel().findUnique({
    where: { userId: normalized },
    include: { user: true },
  });
  return revealProviderApplicant(row);
};

export const getProviderApplicantById = async (id: string): Promise<any | null> => {
  const normalized = String(id || '').trim();
  if (!normalized) return null;
  const row = await providerApplicantModel().findUnique({
    where: { id: normalized },
    include: { user: true },
  });
  return revealProviderApplicant(row);
};

export const listProviderApplicants = async (input: {
  status?: string | null;
  limit?: number;
} = {}): Promise<any[]> => {
  const status = input.status ? normalizeStatus(input.status) : null;
  const limit = Math.min(Math.max(Number(input.limit || 250), 1), 500);
  const rows = await providerApplicantModel().findMany({
    where: status ? { status } : undefined,
    include: { user: true },
    orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  });
  return rows.map(revealProviderApplicant);
};

export const updateProviderApplicantReview = async (
  id: string,
  updates: ProviderApplicantReviewUpdate
): Promise<any> => {
  const data: Record<string, unknown> = {};
  if (updates.status !== undefined) {
    data.status = normalizeStatus(updates.status);
  }
  if (updates.adminNotes !== undefined) {
    data.adminNotes = nullableString(updates.adminNotes);
  }
  if (updates.calendlyShownAt !== undefined) {
    data.calendlyShownAt = updates.calendlyShownAt;
  }
  if (updates.reviewedAt !== undefined) {
    data.reviewedAt = updates.reviewedAt;
  }

  const row = await providerApplicantModel().update({
    where: { id },
    data,
    include: { user: true },
  });
  return revealProviderApplicant(row);
};
