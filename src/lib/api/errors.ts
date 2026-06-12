import axios from "axios";

export class ApiRequestError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
  isNetworkError: boolean;
  isTimeout: boolean;

  constructor(message: string, options?: Partial<ApiRequestError>) {
    super(message);
    this.name = "ApiRequestError";
    this.status = options?.status;
    this.code = options?.code;
    this.details = options?.details;
    this.isNetworkError = Boolean(options?.isNetworkError);
    this.isTimeout = Boolean(options?.isTimeout);
  }
}

export function normalizeApiError(error: unknown) {
  if (error instanceof ApiRequestError) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const payload = error.response?.data as
      | { error?: string; message?: string; code?: string; details?: unknown }
      | undefined;

    return new ApiRequestError(
      payload?.message ??
        payload?.error ??
        (error.code === "ECONNABORTED"
          ? "Tempo limite da requisicao excedido."
          : "Erro ao comunicar com o servidor."),
      {
        status,
        code: payload?.code ?? error.code,
        details: payload?.details ?? payload,
        isNetworkError: !error.response,
        isTimeout: error.code === "ECONNABORTED",
      },
    );
  }

  if (error instanceof Error) {
    return new ApiRequestError(error.message);
  }

  return new ApiRequestError("Erro inesperado.");
}
