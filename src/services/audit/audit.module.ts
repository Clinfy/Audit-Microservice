import { Module } from '@nestjs/common';
import {AuditController} from "src/services/audit/audit.controller";
import {AuditService} from "src/services/audit/audit.service";
import {TypeOrmModule} from "@nestjs/typeorm";
import {AuditLogsEntity} from "src/entities/audit-logs.entity";

@Module({
    imports: [TypeOrmModule.forFeature([AuditLogsEntity])],
    controllers: [AuditController],
    providers: [AuditService],
    exports: [AuditService]
})
export class AuditModule {}
