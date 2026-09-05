import { listAdminMessages } from './adminMessageStore';

// Explicit public fields prevent internal notes and included User credentials from leaking.
export const toApplicantPortalRecord = (row: Record<string, unknown>) => {
  const fields = ['id', 'email', 'firstName', 'lastName', 'phone', 'communicationPreference',
    'providerCategory', 'organizationName', 'professionalTitle', 'serviceArea', 'availabilityMode',
    'servicesOffered', 'targetAudience', 'populationsServed', 'experienceLevel', 'yearsExperience',
    'practiceStatus', 'availabilityToServe', 'credentialsText', 'resumeFile', 'coverLetterFile',
    'alignmentAnswers', 'status', 'submittedAt', 'calendlyShownAt'];
  return Object.fromEntries(fields.filter((key) => key in row).map((key) => [key, row[key]]));
};

export const listApplicantFollowUps = async (userId: string, applicantId: string) => {
  const messages = await listAdminMessages({
    submitterUserId: userId, applicantId, source: 'provider_applicant_follow_up', limit: 250,
  });
  return messages.map(({ id, message, createdAt }) => ({ id, message, createdAt }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};
