import {Module} from '@nestjs/common';
import {AppController} from './app.controller';
import {AppService} from './app.service';
import {AuditModule} from 'src/services/audit/audit.module';
import {ConfigModule, ConfigService} from "@nestjs/config";
import {TypeOrmModule} from "@nestjs/typeorm";
import {AuditLogsEntity} from "src/entities/audit-logs.entity";

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

    TypeOrmModule.forFeature([AuditLogsEntity]),
    AuditModule
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
