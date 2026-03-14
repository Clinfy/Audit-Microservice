import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import axios, { isAxiosError } from 'axios';
import { propagateAxiosError } from 'src/common/tools/propagate-axios-error';
import { Permissions } from 'src/middlewares/decorators/permission.decorator';
import { getClientIp } from 'src/common/tools/get-client-ip';
import { ConfigService } from '@nestjs/config';
import { extractAuthToken } from 'src/common/tools/extract-bearer-auth';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest();
      const token = extractAuthToken(request);

      const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
        Permissions,
        [context.getHandler(), context.getClass()],
      );

      if (!requiredPermissions || requiredPermissions.length === 0) return true;

      const baseUrl = process.env.AUTH_SERVICE_URL;

      const requestAuth = requiredPermissions.map((permission: string) =>
        axios.get(`${baseUrl}/users/can-do/${permission}`, {
          headers: {
            'x-api-key': this.configService.get<string>('AUTH_SERVICE_API_KEY'),
            Authorization: `Bearer ${token}`,
            'content-type': 'application/json',
            'x-forwarded-for': getClientIp(request),
            'x-real-ip': getClientIp(request),
            'user-agent': request.headers['user-agent'] || '',
          },
        }),
      );

      const result = await Promise.allSettled(requestAuth);

      const atLeastOneAllowed = result.some(
        (result) => result.status === 'fulfilled' && result.value.data,
      );

      if (atLeastOneAllowed) return true;

      const rejected = result.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );
      const axiosReject = rejected.find((r) => isAxiosError(r.reason));
      if (axiosReject) propagateAxiosError(axiosReject.reason);

      return false;
    } catch (error) {
      throw error;
    }
  }
}