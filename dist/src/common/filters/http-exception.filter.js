"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoeHttpExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
function normalizeValidationErrors(responseBody) {
    if (responseBody &&
        typeof responseBody === 'object' &&
        'message' in responseBody) {
        const msg = responseBody.message;
        if (Array.isArray(msg) && msg.every((m) => typeof m === 'string')) {
            return { _errors: msg };
        }
    }
    return undefined;
}
let MoeHttpExceptionFilter = class MoeHttpExceptionFilter {
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const res = ctx.getResponse();
        const req = ctx.getRequest();
        if (exception instanceof Error && exception.constructor?.name === 'MulterError') {
            const multerError = exception;
            if (multerError.code === 'LIMIT_FILE_SIZE') {
                const body = {
                    message: 'Image must be 2MB or smaller',
                    code: 'VALIDATION_ERROR',
                };
                return res.status(400).json(body);
            }
        }
        const isHttp = exception instanceof common_1.HttpException;
        const status = isHttp
            ? exception.getStatus()
            : common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        const responseBody = isHttp ? exception.getResponse() : undefined;
        const message = (typeof responseBody === 'string'
            ? responseBody
            : responseBody?.message) ??
            (isHttp ? exception.message : 'Internal server error');
        const msgString = Array.isArray(message) ? message.join(', ') : String(message);
        let code = 'INTERNAL_SERVER_ERROR';
        if (status === 400 || status === 422)
            code = 'VALIDATION_ERROR';
        else if (status === 401)
            code = 'AUTH_TOKEN_EXPIRED';
        else if (status === 403)
            code = 'RESOURCE_NOT_FOUND';
        else if (status === 404)
            code = 'RESOURCE_NOT_FOUND';
        else if (status === 429)
            code = 'RATE_LIMIT_EXCEEDED';
        const errors = normalizeValidationErrors(responseBody);
        const body = {
            message: msgString,
            code,
            ...(errors ? { errors } : {}),
        };
        if (!isHttp && process.env.NODE_ENV === 'production') {
            body.message = 'Internal server error';
            body.code = 'INTERNAL_SERVER_ERROR';
            delete body.errors;
        }
        if (process.env.NODE_ENV !== 'production') {
            body.path = req.url;
        }
        res.status(status).json(body);
    }
};
exports.MoeHttpExceptionFilter = MoeHttpExceptionFilter;
exports.MoeHttpExceptionFilter = MoeHttpExceptionFilter = __decorate([
    (0, common_1.Catch)()
], MoeHttpExceptionFilter);
//# sourceMappingURL=http-exception.filter.js.map