# Backend Field Mapping

This map links frontend profile/social state to backend API payloads and persisted fields.

## User Profile Fields

| Frontend Field | API Payload Key | Persistence Field | Data Type |
|---|---|---|---|
| Name | `name` | `User.name` | `String` |
| Handle | `handle` | `User.handle` | `String` |
| Bio | `bio` | `User.bio` | `String` |
| Location | `location` | `User.location` | `String` |
| Date of Birth | `dateOfBirth` | `User.dateOfBirth` | `DateTime` |
| Avatar URL | `avatarUrl` | `User.avatarUrl` | `String(URL)` |
| Cover URL | `bannerUrl` | `User.bannerUrl` | `String(URL)` |
| Profile Media Metadata | `profileMedia` | `User.profileMedia` | `JSON` |
| Interests | `interests` | `User.interests` | `Array<String>` (JSON) |
| Twitter URL | `twitterUrl` | `User.twitterUrl` | `String(URL)` |
| GitHub URL | `githubUrl` | `User.githubUrl` | `String(URL)` |
| Website URL | `websiteUrl` | `User.websiteUrl` | `String(URL)` |
| Privacy Settings | `privacySettings` | `User.privacySettings` | `JSON` |
| Profile Background Video | `profileBackgroundVideo` | `User.profileBackgroundVideo` | `String(URL)` |
| 2FA Method | `twoFactorMethod` | `User.twoFactorMethod` | `Enum String` (`none`, `phone`, `wallet`) |
| Phone Number | `phoneNumber` | `User.phoneNumber` | `String` |
| Wallet DID | `walletDid` | `User.walletDid` | `String` |

## Social Fields

| Frontend/API Field | API Payload Key | Persistence Field | Data Type |
|---|---|---|---|
| Post text | `text` | `SocialPost.text` | `String` |
| Post visibility | `visibility` | `SocialPost.visibility` | `Enum String` (`public`, `private`) |
| Post media array | `media[]` | `SocialPostMedia` rows | `Array<Object>` |
| Like action | `POST /api/social/posts/:postId/like` | `SocialPostLike` | join record |
| Follow action | `POST /api/social/users/:targetUserId/follow` | `SocialFollow` | join record |

## Privacy JSON Shape

```json
{
  "profileVisibility": "public",
  "showEmail": false,
  "allowMessages": true,
  "blockedUsers": []
}
```

## Profile Media JSON Shape

```json
{
  "avatar": {
    "url": "https://example.com/uploads/user-id/avatar.jpg",
    "storageProvider": "local",
    "objectKey": "user-id/avatar.jpg"
  },
  "cover": {
    "url": "https://example.com/uploads/user-id/cover.jpg",
    "storageProvider": "local",
    "objectKey": "user-id/cover.jpg"
  }
}
```

