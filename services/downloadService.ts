const isBrowser = (): boolean => typeof window !== 'undefined' && typeof navigator !== 'undefined';

const normalizeMimeType = (mimeType: string): string => {
  const normalized = String(mimeType || '').trim();
  return normalized || 'application/octet-stream';
};

export const createTextDownloadHref = (input: {
  content: string;
  mimeType: string;
}): string => {
  const mimeType = normalizeMimeType(input.mimeType);
  return `data:${mimeType},${encodeURIComponent(input.content)}`;
};

const triggerAnchorDownload = (url: string, filename: string): void => {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || 'download';
  anchor.rel = 'noopener noreferrer';
  anchor.style.position = 'fixed';
  anchor.style.left = '-9999px';
  anchor.style.top = '0';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};

export const openBlobFile = async (input: {
  blob: Blob;
  filename: string;
}): Promise<void> => {
  if (!isBrowser()) return;

  const objectUrl = URL.createObjectURL(input.blob);
  const opened = window.open(objectUrl, '_blank', 'noopener,noreferrer');
  if (!opened) {
    triggerAnchorDownload(objectUrl, input.filename || 'download');
  }
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
};
