import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { AppsService } from 'src/apps/apps.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private appsService: AppsService,
) {}

  async signup(email: string, password: string, name: string) {
    const hash = await bcrypt.hash(password, 10);

    return this.usersService.createUser( email, hash, name);
  }

  async validate(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) return null;

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) return null;

    return user;
  }

    async generateToken(user: any, app: any) {
        const payload = {
            sub: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            client_id: app.client_id,
        };

        return {
            access_token: this.jwtService.sign(payload),
        };
    }

    async getProfile(userId: number) {
        const user = await this.usersService.findById(userId);

        if (!user) {
            throw new Error('User not found');
        }

        // remove password before returning
        const { password, ...safeUser } = user;

        return safeUser;
    }

    async validateApp(clientId: string, clientSecret: string) {
        const app = await this.appsService.findByClientId(clientId);

        if (!app) return null;

        if (app.client_secret !== clientSecret) return null;

        return app;
    }
}