const isBrowser = (): boolean => typeof window !== 'undefined' && typeof navigator !== 'undefined';

const isMobileOrSafariDownloadConstrained = (): boolean => {
  if (!isBrowser()) return false;
  const userAgent = navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(userAgent);
  const isAndroid = /android/.test(userAgent);
  const isSafari = /safari/.test(userAgent) && !/chrome|crios|chromium|edg|edgios|firefox|fxios/.test(userAgent);
  const isEmbeddedBrowser = /instagram|fban|fbav|fb_iab|line|twitter|linkedinapp|tiktok|wv/.test(userAgent);
  return isIos || isAndroid || isSafari || isEmbeddedBrowser;
};

const normalizeMimeType = (mimeType: string): string => {
  const normalized = String(mimeType || '').trim();
  return normalized || 'application/octet-stream';
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

const navigateToDownloadUrl = (url: string): void => {
  window.location.href = url;
};

const readBlobAsDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Unable to prepare file download.'));
    reader.readAsDataURL(blob);
  });

export const downloadTextFile = (input: {
  content: string;
  filename: string;
  mimeType: string;
}): void => {
  if (!isBrowser()) return;
  const mimeType = normalizeMimeType(input.mimeType);
  const filename = input.filename || 'download.txt';

  if (isMobileOrSafariDownloadConstrained()) {
    navigateToDownloadUrl(`data:${mimeType},${encodeURIComponent(input.content)}`);
    return;
  }

  const blob = new Blob([input.content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  try {
    triggerAnchorDownload(objectUrl, filename);
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
};

export const downloadBlobFile = async (input: {
  blob: Blob;
  filename: string;
}): Promise<void> => {
  if (!isBrowser()) return;
  const filename = input.filename || 'download';

  if (isMobileOrSafariDownloadConstrained()) {
    navigateToDownloadUrl(await readBlobAsDataUrl(input.blob));
    return;
  }

  const objectUrl = URL.createObjectURL(input.blob);
  try {
    triggerAnchorDownload(objectUrl, filename);
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
};

export const openBlobFile = async (input: {
  blob: Blob;
  filename: string;
}): Promise<void> => {
  if (!isBrowser()) return;

  if (isMobileOrSafariDownloadConstrained()) {
    navigateToDownloadUrl(await readBlobAsDataUrl(input.blob));
    return;
  }

  const objectUrl = URL.createObjectURL(input.blob);
  const opened = window.open(objectUrl, '_blank', 'noopener,noreferrer');
  if (!opened) {
    triggerAnchorDownload(objectUrl, input.filename || 'download');
  }
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
};
