# Media Upload Backend Logic

Implemented in `server/src/routes/upload.ts`.

## Endpoints

- `POST /api/upload/avatar`  
  Field: `image`  
  Validates image MIME type and stores under `server/public/uploads/<userId>/`.

- `POST /api/upload/cover`  
  Field: `image`  
  Validates image MIME type and stores under `server/public/uploads/<userId>/`.

- `POST /api/upload/profile-background`  
  Field: `video`  
  Validates video MIME type and stores under `server/public/uploads/<userId>/`.

- `POST /api/upload/reflection`  
  Field: `file`  
  Stores document/video uploads under `server/public/uploads/<userId>/`.

## Response Shape

```json
{
  "success": true,
  "fileUrl": "https://your-host/uploads/<userId>/<fileName>",
  "media": {
    "category": "avatar",
    "url": "https://your-host/uploads/<userId>/<fileName>",
    "storageProvider": "local",
    "objectKey": "<userId>/<fileName>",
    "mimeType": "image/png",
    "sizeBytes": 12345
  }
}
```

## Persistence Flow

1. Client uploads media and receives `fileUrl` + `media` metadata.
2. Client sends profile update to `PUT /api/user/:id` with:
   - `avatarUrl` / `bannerUrl`
   - `profileMedia.avatar` / `profileMedia.cover` metadata
3. Backend persists these values to user storage.

