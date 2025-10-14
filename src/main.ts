import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    const configService = app.get(ConfigService);
    const rabbitMqUrl = configService.get<string>('RABBITMQ_URL');

    if (!rabbitMqUrl) {
        throw new Error('Environment variable RABBITMQ_URL is not defined');
    }

    app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.RMQ,
        options: {
            urls: [rabbitMqUrl],
            queue: 'audit_queue',
            wildcards: true,
            queueOptions: {
                durable: true,
            },
            noAck: false,
        },
    });

    await app.startAllMicroservices();
    await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
