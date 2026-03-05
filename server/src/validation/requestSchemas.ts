import type { JsonSchema } from './jsonSchema';

const nullableString = (maxLength = 4096): JsonSchema => ({
  anyOf: [
    { type: 'string', maxLength },
    { type: 'null' },
  ],
});

const privacySettingsSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['profileVisibility', 'showEmail', 'allowMessages', 'blockedUsers'],
  properties: {
    profileVisibility: { type: 'string', enum: ['public', 'private'] },
    showEmail: { type: 'boolean' },
    allowMessages: { type: 'boolean' },
    blockedUsers: {
      type: 'array',
      items: { type: 'string', minLength: 1, maxLength: 256 },
      maxItems: 500,
      uniqueItems: true,
    },
  },
};

const userMediaAssetSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['url', 'storageProvider', 'objectKey'],
  properties: {
    url: nullableString(4096),
    storageProvider: nullableString(128),
    objectKey: nullableString(1024),
  },
};

const profileMediaSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['avatar', 'cover'],
  properties: {
    avatar: userMediaAssetSchema,
    cover: userMediaAssetSchema,
  },
};

const profilePatchProperties: Record<string, JsonSchema> = {
  name: nullableString(200),
  handle: nullableString(100),
  bio: nullableString(2000),
  location: nullableString(200),
  dateOfBirth: {
    anyOf: [
      { type: 'string', maxLength: 128 },
      { type: 'null' },
    ],
  },
  avatarUrl: nullableString(4096),
  bannerUrl: nullableString(4096),
  profileMedia: profileMediaSchema,
  interests: {
    type: 'array',
    items: { type: 'string', minLength: 1, maxLength: 120 },
    maxItems: 20,
  },
  twitterUrl: nullableString(4096),
  githubUrl: nullableString(4096),
  websiteUrl: nullableString(4096),
  privacySettings: privacySettingsSchema,
  profileBackgroundVideo: nullableString(4096),
};

export const socialProfilePatchSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: profilePatchProperties.name,
    handle: profilePatchProperties.handle,
    bio: profilePatchProperties.bio,
    location: profilePatchProperties.location,
    dateOfBirth: profilePatchProperties.dateOfBirth,
    avatarUrl: profilePatchProperties.avatarUrl,
    bannerUrl: profilePatchProperties.bannerUrl,
    profileMedia: profilePatchProperties.profileMedia,
    interests: profilePatchProperties.interests,
    privacySettings: profilePatchProperties.privacySettings,
  },
};

export const socialCreatePostSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    text: { type: 'string', maxLength: 5000 },
    visibility: { type: 'string', enum: ['public', 'private'] },
    media: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['mediaType', 'url'],
        properties: {
          mediaType: { type: 'string', enum: ['image', 'video', 'file'] },
          url: { type: 'string', minLength: 1, maxLength: 10000 },
          storageProvider: nullableString(128),
          objectKey: nullableString(1024),
        },
      },
    },
  },
};

export const socialFollowRequestSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    follow: { type: 'boolean' },
  },
};

export const userSignInSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['email', 'password'],
  properties: {
    email: { type: 'string', minLength: 3, maxLength: 320 },
    password: { type: 'string', minLength: 1, maxLength: 512 },
    twoFactorCode: { type: 'string', maxLength: 32 },
    providerToken: { type: 'string', maxLength: 4096 },
  },
};

export const userCreateSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['email', 'password'],
  properties: {
    email: { type: 'string', minLength: 3, maxLength: 320 },
    password: { type: 'string', minLength: 1, maxLength: 512 },
    name: { type: 'string', maxLength: 200 },
    tier: { type: 'string', maxLength: 200 },
    location: nullableString(200),
    dateOfBirth: profilePatchProperties.dateOfBirth,
    twoFactorMethod: { type: 'string', enum: ['none', 'phone', 'wallet'] },
    phoneNumber: nullableString(32),
    walletDid: nullableString(512),
    avatarUrl: nullableString(4096),
    bannerUrl: nullableString(4096),
    profileMedia: profileMediaSchema,
  },
};

export const userProfilePatchSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: profilePatchProperties,
};

export const userPrivacyUpdateSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['privacySettings'],
  properties: {
    privacySettings: privacySettingsSchema,
  },
};

export const userPhoneEnrollSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['phoneNumber'],
  properties: {
    phoneNumber: { type: 'string', minLength: 7, maxLength: 32 },
  },
};

export const userWalletEnrollSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['walletDid'],
  properties: {
    walletDid: { type: 'string', minLength: 3, maxLength: 512 },
  },
};

export const immersiveSessionEventSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['eventType'],
  properties: {
    eventType: { type: 'string', enum: ['start', 'end', 'error'] },
    sessionMode: {
      anyOf: [
        { type: 'string', enum: ['immersive-ar', 'immersive-vr', 'unknown'] },
        { type: 'null' },
      ],
    },
    deviceProfile: {
      anyOf: [
        { type: 'string', maxLength: 128 },
        { type: 'null' },
      ],
    },
    durationMs: {
      anyOf: [
        { type: 'number', minimum: 0, maximum: 86_400_000 },
        { type: 'null' },
      ],
    },
    errorMessage: {
      anyOf: [
        { type: 'string', maxLength: 500 },
        { type: 'null' },
      ],
    },
    userAgent: {
      anyOf: [
        { type: 'string', maxLength: 512 },
        { type: 'null' },
      ],
    },
    timestamp: {
      anyOf: [
        { type: 'string', maxLength: 64 },
        { type: 'null' },
      ],
    },
  },
};

export const providerBridgeIssueLaunchCodeSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['providerExternalId', 'email', 'name', 'jti', 'aud'],
  properties: {
    providerExternalId: { type: 'string', minLength: 1, maxLength: 256 },
    email: { type: 'string', minLength: 3, maxLength: 320 },
    name: { type: 'string', minLength: 1, maxLength: 200 },
    jti: { type: 'string', minLength: 8, maxLength: 256 },
    aud: { type: 'string', minLength: 1, maxLength: 256 },
    scopes: {
      type: 'array',
      maxItems: 24,
      items: { type: 'string', minLength: 1, maxLength: 128 },
      uniqueItems: true,
    },
  },
};

export const providerBridgeConsumeLaunchCodeSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['code'],
  properties: {
    code: { type: 'string', minLength: 8, maxLength: 256 },
  },
};
