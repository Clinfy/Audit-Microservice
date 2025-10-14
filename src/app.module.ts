import {Module} from '@nestjs/common';
import {AppController} from './app.controller';
import {AppService} from './app.service';
import {AuditModule} from 'src/services/audit/audit.module';
import {ConfigModule, ConfigService} from "@nestjs/config";
import {TypeOrmModule} from "@nestjs/typeorm";
import {AuditLogsEntity} from "src/entities/audit-logs.entity";
import {ClientsModule, Transport} from "@nestjs/microservices";

@Module({
imports: [
    ConfigModule.forRoot({
        isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
            type: 'postgres',
            url: configService.get<string>('DATABASE_URL'),
            entities: [AuditLogsEntity],
            synchronize: true,
        }),
    }),

    ClientsModule.registerAsync([
        {
            name: 'AUDIT_LISTENER_SERVICE',
            imports:[ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                transport: Transport.RMQ,
                options: {
                    urls: [configService.get<string>('RABBITMQ_URL') as string],
                    queue: 'audit_queue',
                    queueOptions: {
                        durable: true
                    },
                    noAck: false,
                }
            })
        }
    ]),

    TypeOrmModule.forFeature([AuditLogsEntity]),
    AuditModule
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
