# Privacy Settings Schema

The application stores privacy settings on each user record in `User.privacySettings` (JSON).

## JSON Schema

```json
{
  "profileVisibility": "public",
  "showEmail": false,
  "allowMessages": true,
  "blockedUsers": []
}
```

## Field Definitions

- `profileVisibility`: `"public"` or `"private"`.
- `showEmail`: if `true`, user email can be displayed on profile responses to authorized viewers.
- `allowMessages`: if `false`, direct message initiation should be disabled in clients.
- `blockedUsers`: array of user IDs blocked by this user.

## Authorization Rules

- Only authenticated users can read or modify their own privacy settings:
  - `GET /api/user/privacy`
  - `PUT /api/user/privacy`
  - `POST /api/user/privacy/block/:blockedUserId`
  - `DELETE /api/user/privacy/block/:blockedUserId`
- User profile updates via `PUT /api/user/:id` enforce canonical identity match.
- Social endpoints deny access for blocked relationships and private profiles where required.

