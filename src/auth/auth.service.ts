import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
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

    async generateToken(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}