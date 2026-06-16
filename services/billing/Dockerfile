# ── Stage 1: deps ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

# ── Stage 2: builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate --schema=prisma/schema.prisma

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Stage 3: runner ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Usuário não-root para segurança
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 billing

COPY --from=deps    /app/node_modules           ./node_modules
COPY --from=builder /app/dist                   ./dist
COPY --from=builder /app/node_modules/.prisma   ./node_modules/.prisma
COPY prisma/schema.prisma                        ./prisma/schema.prisma

USER billing

EXPOSE 3334

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3334/health || exit 1

CMD ["node", "dist/server.js"]
