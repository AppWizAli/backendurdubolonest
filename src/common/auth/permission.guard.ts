import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { AuthenticatedPrincipal } from './auth.types';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;
    const principal = context.switchToHttp().getRequest<{ user?: AuthenticatedPrincipal }>().user;
    if (!principal || (!principal.roles.includes('SUPER_ADMIN') && !required.every((permission) => principal.permissions.includes(permission)))) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
