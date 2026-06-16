export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string) {
    super(`${entity} não encontrado(a)`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Não autorizado') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 422, 'VALIDATION_ERROR');
  }
}

export class SagaError extends AppError {
  constructor(
    message: string,
    public readonly sagaStep: number,
    public readonly compensated: boolean = false,
  ) {
    super(message, 422, 'SAGA_FAILURE');
  }
}

export class CircuitOpenError extends AppError {
  constructor(service: string) {
    super(`Serviço ${service} indisponível (circuit breaker aberto)`, 503, 'CIRCUIT_OPEN');
  }
}
