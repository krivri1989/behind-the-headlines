# ---- Build stage -----------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies (use npm ci for reproducible builds)
COPY package*.json ./
RUN npm ci

# Copy source and build Next.js (standalone output) + worker
COPY . .

RUN npm run build
RUN npx tsc -p tsconfig.worker.json

# ---- Production stage ------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install sharp native deps for image processing
RUN apk add --no-cache libc6-compat

# Copy standalone Next.js server
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# public/ directory may not exist; copy only if present
COPY --from=builder /app/public* ./public

# Copy compiled worker
COPY --from=builder /app/dist ./dist

# Copy node_modules so the worker can resolve its dependencies
# (Next.js standalone only bundles deps used by the web app)
COPY --from=builder /app/node_modules ./node_modules

# Copy seed and test scripts
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package*.json ./

EXPOSE 3000

# Default: start the web server. Worker is started via docker-compose override.
CMD ["node", "server.js"]
