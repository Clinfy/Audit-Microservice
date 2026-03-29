import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { extractAuthToken } from 'src/common/utils/extract-bearer-auth.util';
import { AuthClientService } from 'src/clients/auth/auth-client.service';
import { EndpointKey } from 'src/common/decorators/endpoint-key.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authClient: AuthClientService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest();
      const token = extractAuthToken(request);

      const endpointKey = this.reflector.getAllAndOverride<string>(EndpointKey, [context.getHandler(), context.getClass()]);
      const requiredPermissions = await this.authClient.getEndpointPermissions(endpointKey, request);

      if (!requiredPermissions || requiredPermissions.length === 0) return true;

      const userCanDo = await Promise.all(
        requiredPermissions.map((permission: string) => this.authClient.canDo(permission, token, request)),
      );

      if (!userCanDo.some(Boolean)) throw new UnauthorizedException();

      return userCanDo.some(Boolean);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
