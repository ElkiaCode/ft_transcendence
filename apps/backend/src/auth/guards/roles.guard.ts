import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedRequest } from '../types/authenticated-request.type';

type JwtUser = {
  sub: string;
  email: string;
  username: string;
  role: 'USER' | 'MODERATOR' | 'ADMIN';
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<Array<'USER' | 'MODERATOR' | 'ADMIN'>>(
        ROLES_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? [];

    if (requiredRoles.length === 0) {
      return true;
    }

    // 1. Specify the type here
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // 2. Now 'user' is safely typed as JwtPayload, not 'any'
    const user = request.user as JwtUser | undefined;

    if (!user) {
      throw new ForbiddenException('missing authenticated user');
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('insufficient role');
    }

    return true;
  }
}
