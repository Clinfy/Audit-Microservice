import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditModule } from 'src/services/audit/audit.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsEntity } from 'src/entities/audit-logs.entity';
import { validate } from 'src/config/env-validation';
import { AuthClientService } from 'src/clients/auth/auth-client.service';
import { AllExceptionsFilter } from 'src/common/filters/all-exceptions.filter';
import { WinstonModule } from 'nest-winston';
import winston from 'winston';
import 'winston-daily-rotate-file';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
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

    WinstonModule.forRoot({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      transports: [
        //new winston.transports.Console(),
        new winston.transports.DailyRotateFile({
          filename: 'logs/error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxSize: '5m',
          maxFiles: '14d',
        }),
        new winston.transports.DailyRotateFile({
          filename: 'logs/combined-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '10m',
          maxFiles: '30d',
        }),
      ],
    }),

    TypeOrmModule.forFeature([AuditLogsEntity]),
    AuditModule,
  ],
  controllers: [AppController],
  providers: [AppService, AllExceptionsFilter, AuthClientService],
})
export class AppModule {}
