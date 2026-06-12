# ===== BUILD =====
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build
RUN apk add --no-cache netcat-openbsd
# ===== PRODUÇÃO =====
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache netcat-openbsd

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 fastify

# Dependências
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Aplicação
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src

# Uploads
RUN mkdir -p /app/uploads && \
    chown -R fastify:nodejs /app/uploads

USER fastify

EXPOSE 3333

CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
