import { BadGatewayException, GatewayTimeoutException, HttpException } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { propagateAxiosError } from './propagate-axios-error';

function makeAxiosError(overrides: Partial<AxiosError> = {}): AxiosError {
  const error = new axios.AxiosError('test error') as AxiosError;
  Object.assign(error, overrides);
  return error;
}

describe('propagateAxiosError', () => {
  describe('when the error is not an Axios error', () => {
    it('should rethrow non-Axios errors as-is', () => {
      const plain = new Error('plain error');
      expect(() => propagateAxiosError(plain)).toThrow(plain);
    });

    it('should rethrow non-error values as-is', () => {
      const value = { some: 'object' };
      expect(() => propagateAxiosError(value)).toThrow();
    });
  });

  describe('when the Axios error has a response (upstream responded)', () => {
    it('should throw HttpException with the original status', () => {
      const error = makeAxiosError({ response: { status: 404, data: 'not found' } as any });

      expect(() => propagateAxiosError(error)).toThrow(HttpException);

      try {
        propagateAxiosError(error);
      } catch (e) {
        expect(e).toBeInstanceOf(HttpException);
        expect((e as HttpException).getStatus()).toBe(404);
      }
    });

    it('should normalise a structured body (with errorCode + message) as-is', () => {
      const structuredData = { errorCode: 'NOT_FOUND', message: 'Resource not found' };
      const error = makeAxiosError({ response: { status: 404, data: structuredData } as any });

      try {
        propagateAxiosError(error);
      } catch (e) {
        expect(e).toBeInstanceOf(HttpException);
        const body = (e as HttpException).getResponse() as any;
        expect(body.errorCode).toBe('NOT_FOUND');
        expect(body.message).toBe('Resource not found');
      }
    });

    it('should normalise a 5xx unstructured body with UPSTREAM_ERROR errorCode', () => {
      const error = makeAxiosError({ response: { status: 503, data: 'Service Unavailable' } as any });

      try {
        propagateAxiosError(error);
      } catch (e) {
        expect(e).toBeInstanceOf(HttpException);
        const body = (e as HttpException).getResponse() as any;
        expect(body.errorCode).toBe('UPSTREAM_ERROR');
        expect(body.message).toBe('Service Unavailable');
      }
    });

    it('should normalise a 4xx unstructured body with UPSTREAM_CLIENT_ERROR errorCode', () => {
      const error = makeAxiosError({ response: { status: 401, data: 'Unauthorized' } as any });

      try {
        propagateAxiosError(error);
      } catch (e) {
        expect(e).toBeInstanceOf(HttpException);
        const body = (e as HttpException).getResponse() as any;
        expect(body.errorCode).toBe('UPSTREAM_CLIENT_ERROR');
        expect(body.message).toBe('Unauthorized');
      }
    });

    it('should use "Upstream service error" for empty string body data', () => {
      const error = makeAxiosError({ response: { status: 500, data: '' } as any });

      try {
        propagateAxiosError(error);
      } catch (e) {
        const body = (e as HttpException).getResponse() as any;
        expect(body.message).toBe('Upstream service error');
      }
    });

    it('should use "Upstream service error" for null body data', () => {
      const error = makeAxiosError({ response: { status: 502, data: null } as any });

      try {
        propagateAxiosError(error);
      } catch (e) {
        const body = (e as HttpException).getResponse() as any;
        expect(body.message).toBe('Upstream service error');
      }
    });

    it('should fall back to status 502 when response.status is missing', () => {
      const error = makeAxiosError({ response: { status: undefined as any, data: 'oops' } as any });

      try {
        propagateAxiosError(error);
      } catch (e) {
        expect((e as HttpException).getStatus()).toBe(502);
      }
    });

    it('should reject a body that has errorCode but no message as unstructured', () => {
      const partialData = { errorCode: 'SOME_CODE' }; // missing message
      const error = makeAxiosError({ response: { status: 400, data: partialData } as any });

      try {
        propagateAxiosError(error);
      } catch (e) {
        const body = (e as HttpException).getResponse() as any;
        // Not structured — should be normalised
        expect(body.errorCode).toBe('UPSTREAM_CLIENT_ERROR');
        expect(body.message).toBe('Upstream service error');
      }
    });
  });

  describe('when the Axios error has no response (network/timeout issue)', () => {
    it('should throw GatewayTimeoutException for ECONNABORTED', () => {
      const error = makeAxiosError({ code: 'ECONNABORTED', response: undefined });

      expect(() => propagateAxiosError(error)).toThrow(GatewayTimeoutException);

      try {
        propagateAxiosError(error);
      } catch (e) {
        expect((e as GatewayTimeoutException).message).toBe('Auth service timeout');
      }
    });

    it('should throw BadGatewayException for other network errors', () => {
      const error = makeAxiosError({ code: 'ECONNREFUSED', response: undefined });

      expect(() => propagateAxiosError(error)).toThrow(BadGatewayException);

      try {
        propagateAxiosError(error);
      } catch (e) {
        expect((e as BadGatewayException).message).toBe('Auth service unreachable');
      }
    });

    it('should throw BadGatewayException when code is undefined', () => {
      const error = makeAxiosError({ code: undefined, response: undefined });

      expect(() => propagateAxiosError(error)).toThrow(BadGatewayException);
    });
  });
});
