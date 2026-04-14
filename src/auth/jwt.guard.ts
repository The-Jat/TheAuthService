import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(
        private jwtService: JwtService,
        private db: DatabaseService,
    ) { }


    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();

        const authHeader = request.headers['authorization'];

        if (!authHeader) {
            throw new UnauthorizedException('No token provided');
        }

        const token = authHeader.split(' ')[1];

        // check blacklist
        const blacklisted = await this.db.query(
            `SELECT * FROM token_blacklist WHERE token = $1`,
            [token],
        );

        if (blacklisted[0]) {
            throw new UnauthorizedException('Token revoked');
        }

        if (!token) {
            throw new UnauthorizedException('Invalid token format');
        }

        try {
            const payload = this.jwtService.verify(token);

            // attach user to request
            request.user = payload;

            return true;
        } catch (err) {
            throw new UnauthorizedException('Invalid or expired token');
        }
    }
}