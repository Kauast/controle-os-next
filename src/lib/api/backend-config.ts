export const BACKEND_URL =
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_FASTIFY_URL ??
  "http://localhost:3333";
