import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middlewares/auth';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from './products.controller';

export default async function productsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.get('/', listProducts);
  app.get('/:id', getProduct);
  app.post('/', createProduct);
  app.patch('/:id', updateProduct);
  app.delete('/:id', deleteProduct);
}
