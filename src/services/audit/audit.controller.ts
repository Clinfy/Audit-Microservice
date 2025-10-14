import {Controller, Get} from '@nestjs/common';
import {AuditService} from 'src/services/audit/audit.service';
import {Ctx, EventPattern, Payload, RmqContext} from '@nestjs/microservices';
import {AuditLogsEntity} from 'src/entities/audit-logs.entity';


@Controller('audit')
export class AuditController {
    constructor(private readonly auditService: AuditService) {}

    @EventPattern('#')
    async handleAuditEvent(@Payload() data: any, @Ctx() context: RmqContext) {
        const channel = context.getChannelRef();
        const originalMsg = context.getMessage();
        const pattern = context.getPattern();
        try {
            await this.auditService.recordEvent(pattern ?? 'unknown', data);

            channel.ack(originalMsg);

        } catch (error) {
            console.error('Error handling audit event:', error);
            channel.nack(originalMsg, false, false);
        }
    }

    @Get('all')
    getAllLogs(): Promise<AuditLogsEntity[]> {
        return this.auditService.getAllLogs();
    }
}
