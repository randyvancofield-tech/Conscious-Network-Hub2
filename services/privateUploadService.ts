import { getBackendBaseUrl } from './apiClient';
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

const downloadBlob = (blobUrl: string, filename: string): void => {
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename || 'download';
  anchor.rel = 'noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
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

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const opened = window.open(blobUrl, '_blank', 'noopener,noreferrer');
  if (!opened) {
    downloadBlob(blobUrl, String(file.originalName || 'download'));
  }
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
};
