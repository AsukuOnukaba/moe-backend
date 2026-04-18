import { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
export declare class MoeHttpExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): Response<any, Record<string, any>> | undefined;
}
