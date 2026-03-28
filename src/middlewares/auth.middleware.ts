import {
  CanActivate,
  ExecutionContext,
  Injectable, InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permissions } from 'src/middlewares/decorators/permission.decorator';
import { extractAuthToken } from 'src/common/tools/extract-bearer-auth';
import { AuthClientService } from 'src/clients/auth/auth-client.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly authClient: AuthClientService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest();
      const token = extractAuthToken(request);

      const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
        Permissions,
        [context.getHandler(), context.getClass()],
      );

      if (!requiredPermissions || requiredPermissions.length === 0) return true;

      const userCanDo = await Promise.all(
        requiredPermissions.map((permission: string) =>
          this.authClient.canDo(permission, token, request),
        ),
      );

      if(!userCanDo.some(Boolean)) throw new UnauthorizedException()

      return userCanDo.some(Boolean);

    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}