import { HttpStatus } from '@nestjs/common';
import { BaseServiceException } from 'src/common/exceptions/base-service.exception';

export enum AuthErrorCodes {
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  AUTH_SERVICE_ERROR = 'AUTH_SERVICE_ERROR',
  AUTH_COOKIE_EXPIRED_INVALID = 'AUTH_COOKIE_EXPIRED_INVALID',
}

export class AuthException extends BaseServiceException {
  constructor(message: string, errorCode: AuthErrorCodes, status: HttpStatus, cause?: Error) {
    super(message, errorCode, status, cause);
  }
}
