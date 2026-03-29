import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  describe('getHello', () => {
    it('should return the status string from AppService', () => {
      const result = appController.getHello();
      expect(typeof result).toBe('string');
      expect(result).toContain('status: ok');
    });

    it('should include package name, version, and node version', () => {
      const result = appController.getHello();
      expect(result).toContain('name:');
      expect(result).toContain('version:');
      expect(result).toContain('node:');
    });

    it('should include uptime, memory, and timestamp', () => {
      const result = appController.getHello();
      expect(result).toContain('uptime:');
      expect(result).toContain('memory:');
      expect(result).toContain('now:');
    });

    it('should delegate to AppService.getStatus()', () => {
      const mockStatus = 'status: ok | name: test | version: 1.0.0';
      jest.spyOn(appService, 'getStatus').mockReturnValue(mockStatus);
      expect(appController.getHello()).toBe(mockStatus);
    });
  });
});
