# ===== BUILD =====
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate && npm run build

# ===== PRODUÇÃO =====
FROM node:20-alpine

WORKDIR /app

# netcat para healthcheck; curl não precisa (nc é menor)
RUN apk add --no-cache netcat-openbsd && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 fastify

# Apenas artefatos necessários em produção (sem src/)
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Copiar entrypoint script
COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

RUN mkdir -p /app/uploads && chown -R fastify:nodejs /app/uploads

USER fastify

EXPOSE 3333

# seed deve ser executado manualmente: docker compose exec backend npm run seed
ENTRYPOINT ["/entrypoint.sh"]
