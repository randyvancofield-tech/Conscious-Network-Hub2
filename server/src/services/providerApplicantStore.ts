import { getPrisma } from './prismaClient';

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

export const createProviderApplicant = async (input: ProviderApplicantInput): Promise<any> => {
  const row = await providerApplicantModel().create({
    data: {
      userId: input.userId,
      email: input.email.trim().toLowerCase(),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phone: nullableString(input.phone),
      communicationPreference: nullableString(input.communicationPreference),
      providerCategory: input.providerCategory.trim(),
      organizationName: nullableString(input.organizationName),
      professionalTitle: nullableString(input.professionalTitle),
      website: nullableString(input.website),
      socialLinks: input.socialLinks || [],
      serviceArea: nullableString(input.serviceArea),
      availabilityMode: nullableString(input.availabilityMode),
      servicesOffered: input.servicesOffered || [],
      targetAudience: nullableString(input.targetAudience),
      populationsServed: input.populationsServed || [],
      experienceLevel: nullableString(input.experienceLevel),
      yearsExperience: input.yearsExperience ?? null,
      practiceStatus: nullableString(input.practiceStatus),
      availabilityToServe: nullableString(input.availabilityToServe),
      credentialsText: nullableString(input.credentialsText),
      licenseNumber: nullableString(input.licenseNumber),
      issuingOrganization: nullableString(input.issuingOrganization),
      credentialExpiration: input.credentialExpiration || null,
      professionalReferences: nullableString(input.professionalReferences),
      resumeFile: input.resumeFile,
      coverLetterFile: input.coverLetterFile,
      alignmentAnswers: input.alignmentAnswers,
      integrityConsents: input.integrityConsents,
      status: normalizeStatus(input.status),
      submittedAt: new Date(),
      calendlyShownAt: input.calendlyShownAt || null,
    },
    include: { user: true },
  });
  return row;
};

export const getProviderApplicantByUserId = async (userId: string): Promise<any | null> => {
  const normalized = String(userId || '').trim();
  if (!normalized) return null;
  return providerApplicantModel().findUnique({
    where: { userId: normalized },
    include: { user: true },
  });
};

export const getProviderApplicantById = async (id: string): Promise<any | null> => {
  const normalized = String(id || '').trim();
  if (!normalized) return null;
  return providerApplicantModel().findUnique({
    where: { id: normalized },
    include: { user: true },
  });
};

export const listProviderApplicants = async (input: {
  status?: string | null;
  limit?: number;
} = {}): Promise<any[]> => {
  const status = input.status ? normalizeStatus(input.status) : null;
  const limit = Math.min(Math.max(Number(input.limit || 250), 1), 500);
  return providerApplicantModel().findMany({
    where: status ? { status } : undefined,
    include: { user: true },
    orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  });
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

  return providerApplicantModel().update({
    where: { id },
    data,
    include: { user: true },
  });
};
