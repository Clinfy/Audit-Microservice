import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { AuthClientService } from 'src/clients/auth/auth-client.service';
import { Reflector } from '@nestjs/core';
import { AuditLogsEntity } from 'src/entities/audit-logs.entity';
import { RmqContext } from '@nestjs/microservices';

const mockAuditLog = {
  id: 'test-uuid',
  pattern: 'test.pattern',
  payload: { key: 'value' },
  received_at: new Date('2026-01-01T00:00:00.000Z'),
} as unknown as AuditLogsEntity;

describe('AuditController', () => {
  let controller: AuditController;
  let auditService: jest.Mocked<AuditService>;

  beforeEach(async () => {
    const mockAuditService = {
      recordEvent: jest.fn(),
      getAllLogs: jest.fn(),
      getLogsByPattern: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        { provide: AuditService, useValue: mockAuditService },
        {
          provide: AuthClientService,
          useValue: {
            canDo: jest.fn().mockResolvedValue(true),
            getEndpointPermissions: jest.fn().mockResolvedValue([]),
          },
        },
        Reflector,
        AuthGuard,
      ],
    }).compile();

    controller = module.get<AuditController>(AuditController);
    auditService = module.get(AuditService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleAuditEvent', () => {
    let mockChannel: { ack: jest.Mock; nack: jest.Mock };
    let mockContext: jest.Mocked<RmqContext>;

    beforeEach(() => {
      mockChannel = { ack: jest.fn(), nack: jest.fn() };
      mockContext = {
        getChannelRef: jest.fn().mockReturnValue(mockChannel),
        getMessage: jest.fn().mockReturnValue({ content: 'msg' }),
        getPattern: jest.fn().mockReturnValue('test.event'),
      } as unknown as jest.Mocked<RmqContext>;
    });

    it('should record the event and ack on success', async () => {
      auditService.recordEvent.mockResolvedValue(undefined);

      await controller.handleAuditEvent({ key: 'value' }, mockContext);

      expect(auditService.recordEvent).toHaveBeenCalledWith('test.event', { key: 'value' });
      expect(mockChannel.ack).toHaveBeenCalled();
      expect(mockChannel.nack).not.toHaveBeenCalled();
    });

    it('should use "unknown" as pattern when getPattern returns null', async () => {
      (mockContext.getPattern as jest.Mock).mockReturnValue(null);
      auditService.recordEvent.mockResolvedValue(undefined);

      await controller.handleAuditEvent({}, mockContext);

      expect(auditService.recordEvent).toHaveBeenCalledWith('unknown', {});
      expect(mockChannel.ack).toHaveBeenCalled();
    });

    it('should nack (without requeue) when recordEvent throws', async () => {
      auditService.recordEvent.mockRejectedValue(new Error('DB error'));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      await controller.handleAuditEvent({ key: 'value' }, mockContext);

      expect(mockChannel.nack).toHaveBeenCalledWith(expect.anything(), false, false);
      expect(mockChannel.ack).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });
  });

  describe('getAllLogs', () => {
    it('should return all audit logs from the service', async () => {
      const logs = [mockAuditLog];
      auditService.getAllLogs.mockResolvedValue(logs);

      const result = await controller.getAllLogs();

      expect(auditService.getAllLogs).toHaveBeenCalled();
      expect(result).toEqual(logs);
    });

    it('should return an empty array when there are no logs', async () => {
      auditService.getAllLogs.mockResolvedValue([]);

      const result = await controller.getAllLogs();

      expect(result).toEqual([]);
    });
  });

  describe('getLogsByPattern', () => {
    it('should return logs for the given pattern', async () => {
      const logs = [mockAuditLog];
      auditService.getLogsByPattern.mockResolvedValue(logs);

      const result = await controller.getLogsByPattern('test.pattern');

      expect(auditService.getLogsByPattern).toHaveBeenCalledWith('test.pattern');
      expect(result).toEqual(logs);
    });

    it('should return empty array when no logs match the pattern', async () => {
      auditService.getLogsByPattern.mockResolvedValue([]);

      const result = await controller.getLogsByPattern('no.match');

      expect(result).toEqual([]);
    });
  });
});
