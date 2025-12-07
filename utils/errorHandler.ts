export interface ServiceErrorOptions {
  message: string;
  code?: string;
  context?: string;
  details?: unknown;
}

export class ServiceError extends Error {
  code?: string;
  context?: string;
  details?: unknown;

  constructor({ message, code, context, details }: ServiceErrorOptions) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.context = context;
    this.details = details;
  }
}

const extractErrorProps = (error: unknown) => {
  if (error instanceof ServiceError) {
    return error;
  }

  const fallback: ServiceErrorOptions = {
    message: 'حدث خطأ غير متوقع، الرجاء المحاولة لاحقاً.',
    details: error
  };

  if (!error || typeof error !== 'object') {
    return new ServiceError(fallback);
  }

  const maybeError = error as { message?: string; code?: string; details?: unknown };

  return new ServiceError({
    message: maybeError.message || fallback.message,
    code: maybeError.code,
    details: maybeError.details ?? error
  });
};

export const createServiceError = (error: unknown, context?: string): ServiceError => {
  const normalized = extractErrorProps(error);
  if (context && !normalized.context) {
    normalized.context = context;
  }
  return normalized;
};

export const withServiceErrorHandling = async <T>(operation: () => Promise<T>, context?: string): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    throw createServiceError(error, context);
  }
};

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof ServiceError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'حدث خطأ غير متوقع';
};
