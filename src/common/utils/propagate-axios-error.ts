import { isAxiosError } from 'axios';
import { BadGatewayException, GatewayTimeoutException, HttpException } from '@nestjs/common';

function isStructuredBody(raw: unknown): raw is { errorCode: string; message: string } {
  return (
    raw !== null &&
    typeof raw === 'object' &&
    typeof (raw as Record<string, unknown>).errorCode === 'string' &&
    typeof (raw as Record<string, unknown>).message === 'string'
  );
}

function normalizeUpstreamMessage(raw: unknown): string {
  if (typeof raw === 'string' && raw.length > 0) return raw;
  return 'Upstream service error';
}

// Normalize body to { errorCode, message } so the exception filter can
// extract errorCode reliably regardless of upstream response format.
function normalizeAxiosBody(raw: unknown, status: number): { errorCode: string; message: string } {
  if (isStructuredBody(raw)) return raw;
  return {
    errorCode: status >= 500 ? 'UPSTREAM_ERROR' : 'UPSTREAM_CLIENT_ERROR',
    message: normalizeUpstreamMessage(raw),
  };
}

export function propagateAxiosError(e: unknown): never {
  if (!isAxiosError(e)) throw e;

  if (e.response) {
    const status = e.response.status ?? 502;
    const body = normalizeAxiosBody(e.response.data, status);
    throw new HttpException(body, status);
  }

  if (e.code === 'ECONNABORTED') throw new GatewayTimeoutException('Auth service timeout');
  throw new BadGatewayException('Auth service unreachable');
}
