import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from './audit.service';
import { AuditLogsEntity } from 'src/entities/audit-logs.entity';
import { Repository } from 'typeorm';

const mockAuditLog = {
  id: 'test-uuid',
  pattern: 'test.pattern',
  payload: { key: 'value' },
  received_at: new Date('2026-01-01T00:00:00.000Z'),
} as unknown as AuditLogsEntity;

describe('AuditService', () => {
  let service: AuditService;
  let repository: jest.Mocked<Repository<AuditLogsEntity>>;

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getRepositoryToken(AuditLogsEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    repository = module.get(getRepositoryToken(AuditLogsEntity));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordEvent', () => {
    it('should create and save a new audit log entry', async () => {
      repository.create.mockReturnValue(mockAuditLog);
      repository.save.mockResolvedValue(mockAuditLog);

      await service.recordEvent('test.pattern', { key: 'value' });

      expect(repository.create).toHaveBeenCalledWith({
        pattern: 'test.pattern',
        payload: { key: 'value' },
      });
      expect(repository.save).toHaveBeenCalledWith(mockAuditLog);
    });

    it('should propagate repository errors', async () => {
      repository.create.mockReturnValue(mockAuditLog);
      repository.save.mockRejectedValue(new Error('DB connection failed'));

      await expect(service.recordEvent('test.pattern', {})).rejects.toThrow('DB connection failed');
    });
  });

  describe('getAllLogs', () => {
    it('should return all audit logs', async () => {
      const logs = [mockAuditLog, { ...mockAuditLog, id: 'uuid-2' } as unknown as AuditLogsEntity];
      repository.find.mockResolvedValue(logs);

      const result = await service.getAllLogs();

      expect(repository.find).toHaveBeenCalledWith();
      expect(result).toEqual(logs);
    });

    it('should return an empty array when there are no logs', async () => {
      repository.find.mockResolvedValue([]);

      const result = await service.getAllLogs();

      expect(result).toEqual([]);
    });
  });

  describe('getLogsByPattern', () => {
    it('should return logs filtered by pattern', async () => {
      const logs = [mockAuditLog];
      repository.find.mockResolvedValue(logs);

      const result = await service.getLogsByPattern('test.pattern');

      expect(repository.find).toHaveBeenCalledWith({ where: { pattern: 'test.pattern' } });
      expect(result).toEqual(logs);
    });

    it('should return empty array when no logs match the pattern', async () => {
      repository.find.mockResolvedValue([]);

      const result = await service.getLogsByPattern('non.existent');

      expect(result).toEqual([]);
    });
  });
});
