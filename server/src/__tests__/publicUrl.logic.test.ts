import {
  absolutizeBackendUrl,
  buildBackendUploadObjectUrl,
  extractUploadObjectKeyFromUrl,
  getBackendPublicBaseUrl,
} from '../services/publicUrl';

const mockRequest = (origin: string): any => {
  const parsed = new URL(origin);
  return {
    protocol: parsed.protocol.replace(':', ''),
    get: (name: string) => (name.toLowerCase() === 'host' ? parsed.host : undefined),
    headers: {
      'x-forwarded-proto': parsed.protocol.replace(':', ''),
    },
  };
};

describe('public backend URL resolution', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.FRONTEND_BASE_URL = 'https://conscious-network.org';
    process.env.CORS_ORIGINS = 'https://conscious-network.org';
    delete process.env.BACKEND_PUBLIC_BASE_URL;
    delete process.env.PUBLIC_BASE_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses the explicit backend public base URL when configured', () => {
    process.env.BACKEND_PUBLIC_BASE_URL = 'https://api.conscious-network.org/';
    process.env.PUBLIC_BASE_URL = 'https://conscious-network.org';

    expect(getBackendPublicBaseUrl(mockRequest('https://render-backend.example'))).toBe(
      'https://api.conscious-network.org'
    );
  });

  it('falls back to the backend request origin when PUBLIC_BASE_URL is the frontend origin', () => {
    process.env.PUBLIC_BASE_URL = 'https://conscious-network.org';

    expect(getBackendPublicBaseUrl(mockRequest('https://conscious-network-backend.onrender.com'))).toBe(
      'https://conscious-network-backend.onrender.com'
    );
  });

  it('rewrites frontend-hosted upload object URLs to the backend origin', () => {
    process.env.PUBLIC_BASE_URL = 'https://conscious-network.org';
    const req = mockRequest('https://conscious-network-backend.onrender.com');

    expect(absolutizeBackendUrl(req, 'https://conscious-network.org/uploads/object/opaque-key')).toBe(
      'https://conscious-network-backend.onrender.com/uploads/object/opaque-key'
    );
  });

  it('extracts upload object keys from public and protected upload routes', () => {
    expect(extractUploadObjectKeyFromUrl('opaque-key')).toBe('opaque-key');
    expect(extractUploadObjectKeyFromUrl('/uploads/object/opaque-key')).toBe('opaque-key');
    expect(extractUploadObjectKeyFromUrl('/api/upload/object/opaque-key')).toBe('opaque-key');
    expect(extractUploadObjectKeyFromUrl('https://conscious-network.org/uploads/object/opaque-key')).toBe(
      'opaque-key'
    );
  });

  it('builds backend public upload URLs from the backend request origin', () => {
    process.env.PUBLIC_BASE_URL = 'https://conscious-network.org';
    const req = mockRequest('https://conscious-network-backend.onrender.com');

    expect(buildBackendUploadObjectUrl(req, 'opaque-key', 'public')).toBe(
      'https://conscious-network-backend.onrender.com/uploads/object/opaque-key'
    );
  });

  it('preserves unrelated absolute external media URLs', () => {
    process.env.PUBLIC_BASE_URL = 'https://conscious-network.org';
    const external = 'https://images.unsplash.com/photo.jpg';

    expect(absolutizeBackendUrl(mockRequest('https://conscious-network-backend.onrender.com'), external)).toBe(
      external
    );
  });
});
