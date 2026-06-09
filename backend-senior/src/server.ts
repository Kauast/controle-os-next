import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { buildApp } from './app';

export const prisma = new PrismaClient();

buildApp().then((app) => {
  app.listen({ port: Number(process.env.PORT) || 3333, host: '0.0.0.0' }, (err) => {
    if (err) {
      app.log.error(err);
      process.exit(1);
    }
  });
});
