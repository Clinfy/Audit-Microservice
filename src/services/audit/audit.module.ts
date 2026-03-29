import { Module } from '@nestjs/common';
import { AuditController } from 'src/services/audit/audit.controller';
import { AuditService } from 'src/services/audit/audit.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsEntity } from 'src/entities/audit-logs.entity';
import { AuthClientService } from 'src/clients/auth/auth-client.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLogsEntity])],
  controllers: [AuditController],
  providers: [AuditService, AuthClientService],
  exports: [AuditService],
})
export class AuditModule {}
