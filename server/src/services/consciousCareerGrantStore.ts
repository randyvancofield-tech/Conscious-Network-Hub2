import { getPrisma } from './prismaClient';
import {
  protectSensitiveJson,
  protectSensitiveText,
  revealSensitiveJson,
  revealSensitiveText,
} from './sensitiveDataPolicy';

export interface ConsciousCareerGrantApplicationInput {
  userId: string;
  country: string;
  region?: string | null;
  locality?: string | null;
  postalCode?: string | null;
  legalName?: string | null;
  applicantType: string;
  ventureStage: string;
  requestedAmountUsd: number;
  useOfFunds: unknown;
  answers: Record<string, unknown>;
}

const grantModel = () => (getPrisma() as any).consciousCareerGrantApplication;

const field = (name: string): string => `consciousCareerGrant.${name}`;

const nullableString = (value: unknown): string | null => {
  const normalized = String(value || '').trim();
  return normalized || null;
};

const protectText = (name: string, value: unknown): string | null =>
  protectSensitiveText(field(name), nullableString(value));

const revealText = (name: string, value: unknown): string | null =>
  revealSensitiveText(field(name), nullableString(value));

const revealGrantApplication = (row: any): any => {
  if (!row) return row;
  return {
    ...row,
    region: revealText('region', row.region),
    locality: revealText('locality', row.locality),
    postalCode: revealText('postalCode', row.postalCode),
    legalName: revealText('legalName', row.legalName),
    useOfFunds: revealSensitiveJson(field('useOfFunds'), row.useOfFunds) || {},
    answers: revealSensitiveJson(field('answers'), row.answers) || {},
  };
};

export const createConsciousCareerGrantApplication = async (
  input: ConsciousCareerGrantApplicationInput
): Promise<any> => {
  const row = await grantModel().create({
    data: {
      userId: input.userId,
      country: input.country.trim(),
      region: protectText('region', input.region),
      locality: protectText('locality', input.locality),
      postalCode: protectText('postalCode', input.postalCode),
      legalName: protectText('legalName', input.legalName),
      applicantType: input.applicantType.trim(),
      ventureStage: input.ventureStage.trim(),
      requestedAmountUsd: Math.floor(input.requestedAmountUsd),
      useOfFunds: protectSensitiveJson(field('useOfFunds'), input.useOfFunds || {}),
      answers: protectSensitiveJson(field('answers'), input.answers || {}),
      status: 'submitted',
      submittedAt: new Date(),
    },
    include: { user: true },
  });
  return revealGrantApplication(row);
};
