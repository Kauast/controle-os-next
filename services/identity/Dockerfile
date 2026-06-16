# ─── Stage 1: builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Instala dependencias de build
COPY package.json package-lock.json* ./
RUN npm install

# Copia schema Prisma antes de gerar o client
COPY prisma ./prisma
RUN npx prisma generate

# Copia codigo-fonte e compila TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Remove devDependencies para imagem final menor
RUN npm prune --omit=dev

# ─── Stage 2: runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Instala dumb-init para tratamento correto de sinais (PID 1)
RUN apk add --no-cache dumb-init

# Cria usuario nao-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copia apenas o necessario do builder
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/prisma ./prisma

USER appuser

EXPOSE 3334

# Healthcheck via /health (liveness — nao toca dependencias, resposta rapida)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3334/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
