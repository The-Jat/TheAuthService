import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(private requiredScopes: string[]) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user || !user.scopes) {
      throw new ForbiddenException('No scopes found');
    }

    const hasScope = this.requiredScopes.every(scope =>
      user.scopes.includes(scope),
    );

    if (!hasScope) {
      throw new ForbiddenException('Insufficient scope');
    }

    return true;
  }
}