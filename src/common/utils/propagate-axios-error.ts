import { isAxiosError } from 'axios';
import { BadGatewayException, GatewayTimeoutException, HttpException } from '@nestjs/common';

export function propagateAxiosError(e: unknown): never {
  if (isAxiosError(e)) {
    if (e.response) {
      const status = e.response.status ?? 502;
      const raw = e.response.data;

      // Normalize body to { errorCode, message } so the exception filter can
      // extract errorCode reliably regardless of upstream response format.
      const isStructured =
        raw !== null && typeof raw === 'object' && typeof raw.errorCode === 'string' && typeof raw.message === 'string';

      const body = isStructured
        ? raw
        : {
            errorCode: status >= 500 ? 'UPSTREAM_ERROR' : 'UPSTREAM_CLIENT_ERROR',
            message: typeof raw === 'string' && raw.length > 0 ? raw : 'Upstream service error',
          };

      throw new HttpException(body, status);
    }
    if (e.code === 'ECONNABORTED') throw new GatewayTimeoutException('Auth service timeout');
    throw new BadGatewayException('Auth service unreachable');
  }
  throw e;
}
