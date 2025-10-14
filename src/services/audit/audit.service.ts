import { Injectable } from '@nestjs/common';
import {InjectRepository} from "@nestjs/typeorm";
import {AuditLogsEntity} from "src/entities/audit-logs.entity";
import {Repository} from "typeorm";

@Injectable()
export class AuditService {
    constructor(
        @InjectRepository(AuditLogsEntity)
        private readonly auditLogsRepository: Repository<AuditLogsEntity>,
    ) {}

    async recordEvent(pattern: string, payload: Record<string, any>) {
        const auditLog = this.auditLogsRepository.create({
            pattern,
            payload,
        });
        await this.auditLogsRepository.save(auditLog);
    }

    async getAllLogs(): Promise<AuditLogsEntity[]> {
        return await this.auditLogsRepository.find();
    }
}
