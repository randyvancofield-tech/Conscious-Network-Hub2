import { getBackendBaseUrl } from './apiClient';
import { openBlobFile } from './downloadService';
import { getAuthToken } from './sessionService';

export interface PrivateUploadRef {
  objectKey?: string;
  url?: string;
  originalName?: string;
}

const extractObjectKey = (file: PrivateUploadRef): string => {
  const directKey = String(file.objectKey || '').trim();
  if (directKey) return directKey;

  const rawUrl = String(file.url || '').trim();
  if (!rawUrl) return '';

  try {
    const parsed = /^[a-z][a-z0-9+.-]*:/i.test(rawUrl)
      ? new URL(rawUrl)
      : new URL(rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`, 'http://localhost');
    const match = /^\/(?:api\/upload|uploads)\/object\/([^/?#]+)/i.exec(parsed.pathname);
    return match?.[1] ? decodeURIComponent(match[1]) : '';
  } catch {
    return '';
  }
};

const buildPrivateUploadUrl = (objectKey: string): string => {
  const baseUrl = getBackendBaseUrl();
  return `${baseUrl}/api/upload/object/${encodeURIComponent(objectKey)}`;
};

export const openPrivateUpload = async (file: PrivateUploadRef): Promise<void> => {
  const objectKey = extractObjectKey(file);
  if (!objectKey) {
    throw new Error('This file is missing a retrievable object key.');
  }

  const token = getAuthToken();
  if (!token) {
    throw new Error('Sign in again to open this private file.');
  }

  const response = await fetch(buildPrivateUploadUrl(objectKey), {
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to open private file (HTTP ${response.status}).`);
  }

  await openBlobFile({
    blob: await response.blob(),
    filename: String(file.originalName || 'download'),
  });
};
