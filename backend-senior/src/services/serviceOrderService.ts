// Re-exporta do módulo refatorado — mantém compatibilidade com imports legados
export { ServiceOrderService } from '../modules/service-order/service-order.service';
export {
  createServiceOrderSchema as createOSSchema,
  updateExecutionSchema,
  updateStatusSchema,
  assignSchema,
  canTransition,
  type CreateServiceOrderInput as CreateOSInput,
  type UpdateExecutionInput,
  type UpdateStatusInput,
  type AssignInput,
} from '../modules/service-order/service-order.rules';
