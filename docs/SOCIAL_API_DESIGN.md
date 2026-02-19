# Social API Design

Base path: `/api/social` (authenticated routes)

## Profile

### `GET /profile/:userId`
- Returns public profile info and recent posts.
- Enforces privacy visibility and block checks.

### `POST /profile`
- Updates authenticated user's social/profile fields.
- Supports: `name`, `handle`, `bio`, `location`, `avatarUrl`, `bannerUrl`, `profileMedia`, `interests`, `privacySettings`.

## Posts

### `POST /posts`
- Creates a post.
- Payload:
```json
{
  "text": "Post body",
  "visibility": "public",
  "media": [
    {
      "mediaType": "image",
      "url": "https://cdn.example.com/file.jpg",
      "storageProvider": "local",
      "objectKey": "user-id/file.jpg"
    }
  ]
}
```

### `POST /posts/:postId/like`
- Toggles like/unlike for the authenticated user.

## Follow

### `POST /users/:targetUserId/follow`
- Follows or unfollows a user.
- Optional payload:
```json
{
  "follow": true
}
```
- If `follow` is omitted, the backend toggles current state.

## Newsfeed

### `GET /newsfeed?limit=20&cursor=<postId>`
- Returns a visibility-filtered feed for the authenticated user.
- Includes public posts and private posts from followed/self users.
- Excludes blocked relationships.

