import crypto from 'crypto';
import {
  getUploadObjectAccessMetadata,
  isUploadObjectPubliclyReadable,
} from '../services/uploadBlobStore';

const signKeyPayload = (payload: Record<string, unknown>, secret: string): string =>
  crypto
    .createHmac('sha256', secret)
    .update(
      JSON.stringify({
        v: payload.v,
        oid: payload.oid,
        mimeType: payload.mimeType,
        originalName: payload.originalName,
        userId: payload.userId || null,
        access: payload.access || null,
        category: payload.category || null,
      }),
      'utf8'
    )
    .digest('base64url');

const encodeKey = (payload: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');

describe('upload object key access metadata', () => {
  beforeEach(() => {
    process.env.SENSITIVE_DATA_KEY = 'upload-key-signing-test-secret';
    delete process.env.UPLOAD_OBJECT_KEY_SECRET;
    delete process.env.UPLOAD_ALLOW_LEGACY_PUBLIC_OBJECTS;
    delete process.env.UPLOAD_ALLOW_LEGACY_AUTHENTICATED_OBJECTS;
  });

  it('accepts signed public keys as publicly readable', () => {
    const payload = {
      v: 2,
      oid: 123,
      mimeType: 'image/png',
      originalName: 'cover.png',
      access: 'public',
      category: 'cover',
    };
    const objectKey = encodeKey({
      ...payload,
      sig: signKeyPayload(payload, process.env.SENSITIVE_DATA_KEY || ''),
    });

    expect(isUploadObjectPubliclyReadable(objectKey)).toBe(true);
    expect(getUploadObjectAccessMetadata(objectKey)).toMatchObject({
      access: 'public',
      ownerUserId: null,
      category: 'cover',
      isLegacy: false,
    });
  });

  it('rejects signed key tampering that changes private access or owner', () => {
    const payload = {
      v: 2,
      oid: 456,
      mimeType: 'application/pdf',
      originalName: 'resume.pdf',
      userId: 'applicant-a',
      access: 'private',
      category: 'provider-application',
    };
    const signed = {
      ...payload,
      sig: signKeyPayload(payload, process.env.SENSITIVE_DATA_KEY || ''),
    };
    const publicTamper = encodeKey({ ...signed, access: 'public' });
    const ownerTamper = encodeKey({ ...signed, userId: 'applicant-b' });

    expect(getUploadObjectAccessMetadata(publicTamper)).toBeNull();
    expect(isUploadObjectPubliclyReadable(publicTamper)).toBe(false);
    expect(getUploadObjectAccessMetadata(ownerTamper)).toBeNull();
  });

  it('treats unsigned legacy keys as non-public unless explicitly enabled', () => {
    const legacyKey = encodeKey({
      v: 1,
      oid: 789,
      mimeType: 'image/png',
      originalName: 'legacy.png',
      access: 'public',
    });

    expect(getUploadObjectAccessMetadata(legacyKey)).toMatchObject({
      access: 'legacy',
      isLegacy: true,
    });
    expect(isUploadObjectPubliclyReadable(legacyKey)).toBe(false);

    process.env.UPLOAD_ALLOW_LEGACY_PUBLIC_OBJECTS = 'true';
    expect(isUploadObjectPubliclyReadable(legacyKey)).toBe(true);
  });
});
