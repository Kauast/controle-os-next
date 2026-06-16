# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY prisma ./prisma/
RUN npx prisma generate

COPY src ./src/
RUN npm run build

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Apenas dependencias de producao
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Artefatos gerados no stage de build
COPY --from=builder /app/dist          ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma/

# Usuario nao-root para reducao de superficie de ataque
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3334

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3334/health || exit 1

CMD ["node", "dist/server.js"]
