export function getPwaInstallabilityState(options = {}) {
  const navigatorRef = options.navigator ?? globalThis.navigator;
  const locationRef = options.location ?? globalThis.location;
  const userAgent = options.userAgent ?? navigatorRef?.userAgent ?? '';
  const isStandalone = Boolean(
    options.isStandalone ??
      navigatorRef?.standalone ??
      (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
  );

  const hostname = locationRef?.hostname ?? '';
  const protocol = locationRef?.protocol ?? '';
  const isLocalhost = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(hostname);
  const isSecureContext = Boolean(
    options.isSecureContext ??
      ((navigatorRef?.isSecureContext ?? false) || protocol === 'https:' || isLocalhost)
  );

  const isAndroid = /android/i.test(userAgent);
  const isIOS = /iphone|ipad|ipod/i.test(userAgent);
  const isChrome = /chrome|crios|samsungbrowser/i.test(userAgent);
  const isSafari = /safari/i.test(userAgent) && !/chrome|crios|android/i.test(userAgent);
  const isEdge = /edg/i.test(userAgent);

  const browserLabel = isAndroid && isChrome
    ? 'Chrome on Android'
    : isIOS && isSafari
      ? 'Safari on iOS'
      : isEdge
        ? 'Microsoft Edge'
        : isChrome
          ? 'Chrome or Chromium'
          : isSafari
            ? 'Safari'
            : 'your browser';

  const platformLabel = isIOS ? 'iPhone or iPad' : isAndroid ? 'Android device' : 'this device';
  const canUseNativeInstallPrompt = isSecureContext && !isStandalone && (typeof window !== 'undefined');
  const installPromptUrl = protocol === 'https:' || isLocalhost ? 'Use the browser menu or share sheet' : 'Switch to HTTPS';

  const menuSteps = isIOS
    ? [
        'Open the page in Safari and tap the Share button.',
        'Choose Add to Home Screen from the share sheet.',
        'Confirm the app name and open it from the Home Screen.',
      ]
    : [
        'Open the browser menu or address bar overflow menu.',
        'Choose Install App, Add to Home Screen, or Add to desktop when your browser offers it.',
        'Confirm the app name and launch it from your home screen or app list.',
      ];

  const menuGuideSummary = isSecureContext
    ? 'The app is ready to be installed from a secure origin. If your browser does not show a direct install prompt, use the browser menu path below.'
    : 'Install requires a secure origin. Use an HTTPS deployment or localhost to enable native installation prompts and the browser installation flow.';

  return {
    isStandalone,
    isSecureContext,
    canUseNativeInstallPrompt,
    browserLabel,
    platformLabel,
    primaryActionLabel: canUseNativeInstallPrompt ? 'Install App' : 'Open install guide',
    menuGuideTitle: isIOS ? 'Safari Add to Home Screen' : 'Browser Menu Guide',
    menuGuideSummary,
    menuSteps,
    installPromptUrl,
    installGuidanceHeadline: isSecureContext
      ? 'Install Higher Conscious Network'
      : 'Secure connection required',
  };
}
