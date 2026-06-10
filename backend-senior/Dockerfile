FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 fastify
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
RUN mkdir -p /app/uploads && chown fastify:nodejs /app/uploads
USER fastify
EXPOSE 3333
CMD ["npm", "run", "start"]
