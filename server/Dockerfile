# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package and Prisma config first so client generation is cacheable.
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

# Ensure Prisma generation has a datasource during image build.
ENV DATABASE_URL=file:./prisma/dev.db
ENV DATABASE_PROVIDER=sqlite

# Install dependencies and generate Prisma client.
RUN npm ci
RUN npx prisma generate

# Copy source code and build.
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Runtime stage
FROM node:18-alpine

WORKDIR /app

# Copy package metadata and Prisma files.
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

# Install production dependencies only.
RUN npm ci --omit=dev

# Copy generated Prisma client from builder.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy compiled backend code.
COPY --from=builder /app/dist ./dist

# Expose Cloud Run default port
EXPOSE 8080

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "const p=process.env.PORT||8080; require('http').get('http://localhost:'+p+'/health', (r)=>{if(r.statusCode!==200) process.exit(1)}).on('error', ()=>process.exit(1))"

# Start application
CMD ["node", "dist/index.js"]
