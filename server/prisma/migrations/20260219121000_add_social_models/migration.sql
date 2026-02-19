CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialPostMedia" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storageProvider" TEXT,
    "objectKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialPostMedia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialPostLike" (
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialPostLike_pkey" PRIMARY KEY ("userId","postId")
);

CREATE TABLE "SocialFollow" (
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialFollow_pkey" PRIMARY KEY ("followerId","followingId")
);

CREATE INDEX "SocialPost_authorId_idx" ON "SocialPost"("authorId");
CREATE INDEX "SocialPost_createdAt_idx" ON "SocialPost"("createdAt");
CREATE INDEX "SocialPostMedia_postId_idx" ON "SocialPostMedia"("postId");
CREATE INDEX "SocialPostLike_postId_idx" ON "SocialPostLike"("postId");
CREATE INDEX "SocialPostLike_createdAt_idx" ON "SocialPostLike"("createdAt");
CREATE INDEX "SocialFollow_followerId_idx" ON "SocialFollow"("followerId");
CREATE INDEX "SocialFollow_followingId_idx" ON "SocialFollow"("followingId");
CREATE INDEX "SocialFollow_createdAt_idx" ON "SocialFollow"("createdAt");

ALTER TABLE "SocialPost"
ADD CONSTRAINT "SocialPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocialPostMedia"
ADD CONSTRAINT "SocialPostMedia_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocialPostLike"
ADD CONSTRAINT "SocialPostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocialPostLike"
ADD CONSTRAINT "SocialPostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocialFollow"
ADD CONSTRAINT "SocialFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocialFollow"
ADD CONSTRAINT "SocialFollow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

