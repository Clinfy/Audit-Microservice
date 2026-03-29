import { Test, TestingModule } from '@nestjs/testing';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { BaseServiceException } from 'src/common/exceptions/base-service.exception';

// Concrete subclass for testing
class TestServiceException extends BaseServiceException {
  constructor(message: string, errorCode: string, status: HttpStatus, cause?: Error) {
    super(message, errorCode, status, cause);
  }
}

function makeHttpArgumentsHost(overrides: { method?: string; url?: string; ip?: string } = {}): ArgumentsHost {
  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const mockRequest = {
    method: overrides.method ?? 'GET',
    url: overrides.url ?? '/test',
    ip: overrides.ip ?? '127.0.0.1',
  };
  return {
    getType: jest.fn().mockReturnValue('http'),
    switchToHttp: jest.fn().mockReturnValue({
      getResponse: jest.fn().mockReturnValue(mockResponse),
      getRequest: jest.fn().mockReturnValue(mockRequest),
    }),
  } as unknown as ArgumentsHost;
}

function extractResponse(host: ArgumentsHost): { status: number; body: any } {
  const ctx = host.switchToHttp();
  const mockResponse = ctx.getResponse() as any;
  const statusCode = mockResponse.status.mock.calls[0]?.[0];
  const body = mockResponse.json.mock.calls[0]?.[0];
  return { status: statusCode, body };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockLogger: { error: jest.Mock };

  beforeEach(async () => {
    mockLogger = { error: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AllExceptionsFilter, { provide: WINSTON_MODULE_PROVIDER, useValue: mockLogger }],
    }).compile();

    filter = module.get<AllExceptionsFilter>(AllExceptionsFilter);
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  describe('non-HTTP context guard', () => {
    it('should return early and not respond when context type is not http', () => {
      const host: ArgumentsHost = {
        getType: jest.fn().mockReturnValue('rpc'),
        switchToHttp: jest.fn(),
      } as unknown as ArgumentsHost;

      filter.catch(new Error('rpc error'), host);

      expect(host.switchToHttp).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should return early for rmq context type', () => {
      const host: ArgumentsHost = {
        getType: jest.fn().mockReturnValue('rmq'),
        switchToHttp: jest.fn(),
      } as unknown as ArgumentsHost;

      filter.catch(new Error('rmq error'), host);

      expect(host.switchToHttp).not.toHaveBeenCalled();
    });
  });

  describe('HTTP context handling', () => {
    it('should respond 500 for a generic Error', () => {
      const host = makeHttpArgumentsHost();
      filter.catch(new Error('unexpected'), host);

      const { status, body } = extractResponse(host);
      expect(status).toBe(500);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
      expect(body.message).toBe('An unexpected error occurred');
    });

    it('should respond with the HttpException status for HttpException', () => {
      const host = makeHttpArgumentsHost();
      filter.catch(new HttpException('Not Found', HttpStatus.NOT_FOUND), host);

      const { status, body } = extractResponse(host);
      expect(status).toBe(404);
    });

    it('should use errorCode from HttpException response when present', () => {
      const host = makeHttpArgumentsHost();
      filter.catch(
        new HttpException({ message: 'Bad input', errorCode: 'VALIDATION_ERROR', statusCode: 400 }, HttpStatus.BAD_REQUEST),
        host,
      );

      const { body } = extractResponse(host);
      expect(body.errorCode).toBe('VALIDATION_ERROR');
      expect(body.message).toBe('Bad input');
    });

    it('should use INTERNAL_ERROR errorCode when HttpException response has no errorCode', () => {
      const host = makeHttpArgumentsHost();
      filter.catch(new HttpException('Some error', HttpStatus.INTERNAL_SERVER_ERROR), host);

      const { body } = extractResponse(host);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });

    it('should use errorCode from BaseServiceException', () => {
      const host = makeHttpArgumentsHost();
      filter.catch(new TestServiceException('Auth failed', 'AUTH_ERROR', HttpStatus.UNAUTHORIZED), host);

      const { status, body } = extractResponse(host);
      expect(status).toBe(401);
      expect(body.errorCode).toBe('AUTH_ERROR');
    });

    it('should include causeCode when cause chain has a different BaseServiceException errorCode', () => {
      const cause = new TestServiceException('Root cause', 'ROOT_CAUSE_CODE', HttpStatus.BAD_GATEWAY);
      const error = new TestServiceException('Outer', 'OUTER_CODE', HttpStatus.INTERNAL_SERVER_ERROR, cause);

      const host = makeHttpArgumentsHost();
      filter.catch(error, host);

      const { body } = extractResponse(host);
      expect(body.errorCode).toBe('OUTER_CODE');
      expect(body.causeCode).toBe('ROOT_CAUSE_CODE');
    });

    it('should not include causeCode when it equals errorCode', () => {
      const cause = new TestServiceException('Root cause', 'SAME_CODE', HttpStatus.BAD_GATEWAY);
      const error = new TestServiceException('Outer', 'SAME_CODE', HttpStatus.INTERNAL_SERVER_ERROR, cause);

      const host = makeHttpArgumentsHost();
      filter.catch(error, host);

      const { body } = extractResponse(host);
      expect(body.errorCode).toBe('SAME_CODE');
      expect(body.causeCode).toBeUndefined();
    });

    it('should extract the deepest HttpException message from the cause chain', () => {
      const deepCause = new HttpException('Deepest message', HttpStatus.BAD_GATEWAY);
      const middleCause = new TestServiceException('Middle', 'MIDDLE_CODE', HttpStatus.INTERNAL_SERVER_ERROR, deepCause);
      const outer = new TestServiceException('Outer', 'OUTER_CODE', HttpStatus.INTERNAL_SERVER_ERROR, middleCause);

      const host = makeHttpArgumentsHost();
      filter.catch(outer, host);

      const { body } = extractResponse(host);
      expect(body.message).toBe('Deepest message');
    });

    it('should include statusCode, timestamp, and path in the response body', () => {
      const host = makeHttpArgumentsHost({ url: '/audit/all' });
      filter.catch(new Error('test'), host);

      const { body } = extractResponse(host);
      expect(body.statusCode).toBe(500);
      expect(body.path).toBe('/audit/all');
      expect(body.timestamp).toBeDefined();
      expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    });

    it('should log the exception with Winston', () => {
      const host = makeHttpArgumentsHost({ method: 'POST', url: '/audit/all', ip: '1.2.3.4' });
      filter.catch(new Error('some error'), host);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unhandled exception',
        expect.objectContaining({
          method: 'POST',
          url: '/audit/all',
          ip: '1.2.3.4',
          statusCode: 500,
          errorCode: 'INTERNAL_ERROR',
        }),
      );
    });
  });
});
