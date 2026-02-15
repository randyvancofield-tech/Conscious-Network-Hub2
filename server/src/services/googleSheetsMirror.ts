interface MirrorPayload {
  userId: string;
  email: string;
  name: string;
  tier: string;
  createdAt: string;
}

const MIRROR_TIMEOUT_MS = 5000;

export const mirrorUserToGoogleSheets = async (payload: MirrorPayload): Promise<void> => {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MIRROR_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        mirroredAt: new Date().toISOString(),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.warn(
        `[SheetsMirror] Failed to append user row (${response.status})${body ? `: ${body}` : ''}`
      );
    }
  } catch (error) {
    console.warn('[SheetsMirror] Error posting to GOOGLE_SHEETS_WEBHOOK_URL:', error);
  } finally {
    clearTimeout(timer);
  }
};
