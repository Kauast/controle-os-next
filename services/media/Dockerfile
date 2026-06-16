# ─── Stage 1: dependências ───────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# ─── Stage 2: build TypeScript ───────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src

RUN npx prisma generate
RUN npm run build

# ─── Stage 3: imagem final ───────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Usuário não-root para segurança
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Apenas artefatos necessários
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

# Diretório de uploads local (sobrescrito por volume em produção)
RUN mkdir -p /app/uploads && chown -R appuser:appgroup /app

USER appuser

ENV NODE_ENV=production
ENV PORT=3340
EXPOSE 3340

# Healthcheck embutido
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3340/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
