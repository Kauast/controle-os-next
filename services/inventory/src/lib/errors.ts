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
    super(`${entity} nao encontrado(a)`, 404, 'NOT_FOUND');
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
  constructor(message = 'Nao autorizado') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 422, 'VALIDATION_ERROR');
  }
}

export class InsufficientStockError extends AppError {
  constructor(productId: string, available: number, requested: number) {
    super(
      `Estoque insuficiente para produto ${productId}. Disponivel: ${available}, Solicitado: ${requested}`,
      422,
      'INSUFFICIENT_STOCK',
    );
  }
}
