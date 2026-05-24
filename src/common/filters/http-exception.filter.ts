import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ErrorCode } from '../errors/error-codes';

type ErrorBody = {
  message: string;
  code: ErrorCode;
  errors?: Record<string, string[]>;
};

function normalizeValidationErrors(
  responseBody: unknown,
): Record<string, string[]> | undefined {
  // Supports Nest's default ValidationPipe error shape:
  // { message: string[]; error: 'Bad Request'; statusCode: 400 }
  if (
    responseBody &&
    typeof responseBody === 'object' &&
    'message' in responseBody
  ) {
    const msg = (responseBody as { message?: unknown }).message;
    if (Array.isArray(msg) && msg.every((m) => typeof m === 'string')) {
      return { _errors: msg };
    }
  }
  return undefined;
}

@Catch()
export class MoeHttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    // Handle multer file size limit error
    if (exception instanceof Error && exception.constructor?.name === 'MulterError') {
      const multerError = exception as any;
      if (multerError.code === 'LIMIT_FILE_SIZE') {
        const body: ErrorBody = {
          message: 'Image must be 2MB or smaller',
          code: 'VALIDATION_ERROR',
        };
        return res.status(400).json(body);
      }
    }

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseBody = isHttp ? exception.getResponse() : undefined;

    const message =
      (typeof responseBody === 'string'
        ? responseBody
        : (responseBody as { message?: unknown } | undefined)?.message) ??
      (isHttp ? exception.message : 'Internal server error');

    const msgString =
      Array.isArray(message) ? message.join(', ') : String(message);

    let code: ErrorCode = 'INTERNAL_SERVER_ERROR';
    if (status === 400 || status === 422) code = 'VALIDATION_ERROR';
    else if (status === 401) code = 'AUTH_TOKEN_EXPIRED';
    else if (status === 403) code = 'RESOURCE_NOT_FOUND'; // override below when we add RBAC
    else if (status === 404) code = 'RESOURCE_NOT_FOUND';
    else if (status === 429) code = 'RATE_LIMIT_EXCEEDED';

    const errors = normalizeValidationErrors(responseBody);

    const body: ErrorBody = {
      message: msgString,
      code,
      ...(errors ? { errors } : {}),
    };

    // Avoid leaking internals in prod for non-HttpException
    if (!isHttp && process.env.NODE_ENV === 'production') {
      body.message = 'Internal server error';
      body.code = 'INTERNAL_SERVER_ERROR';
      delete body.errors;
    }

    // Attach minimal request info for debugging in dev
    if (process.env.NODE_ENV !== 'production') {
      (body as any).path = req.url;
    }

    res.status(status).json(body);
  }
}
