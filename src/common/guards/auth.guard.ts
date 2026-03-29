import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { extractAuthToken } from 'src/common/utils/extract-bearer-auth.util';
import { AuthClientService } from 'src/clients/auth/auth-client.service';
import { EndpointKey } from 'src/common/decorators/endpoint-key.decorator';
import { AuthErrorCodes, AuthException } from 'src/common/guards/auth.exception';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authClient: AuthClientService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {

    const request = context.switchToHttp().getRequest();
    const token = extractAuthToken(request);

    const endpointKey = this.reflector.getAllAndOverride<string>(EndpointKey, [context.getHandler(), context.getClass()]);
    const requiredPermissions = await this.authClient.getEndpointPermissions(endpointKey, request);

    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const userCanDo = await Promise.all(
      requiredPermissions.map((permission: string) => this.authClient.canDo(permission, token, request)),
    );

    if (!userCanDo.some(Boolean))
      throw new AuthException(
        'You do not have permission to access this resource.',
        AuthErrorCodes.INSUFFICIENT_PERMISSIONS,
        HttpStatus.UNAUTHORIZED,
      );

    return userCanDo.some(Boolean);
  }
}
