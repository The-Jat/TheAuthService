import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import type { TokenRepository } from '../domain/token.repository';
import type { BlacklistRepository } from '../domain/blacklist.repository';
import type { CodeRepository } from '../domain/code.repository';
import type { UserRepository } from 'src/users/domain/user.repository';
import { Logger } from '@nestjs/common';
@Injectable()
export class AuthService {
  private logger = new Logger(AuthService.name);

  constructor(
    // private usersService: UsersService,
    private jwtService: JwtService,
    // private appsService: AppsService,
    @Inject('UserRepository')
    private userRepo: UserRepository,

    @Inject('TokenRepository')
    private tokenRepo: TokenRepository,

    @Inject('BlacklistRepository')
    private blacklistRepo: BlacklistRepository,

    @Inject('CodeRepository')
    private codeRepo: CodeRepository,
  ) { }

  async signup(email: string, password: string, name: string) {
    this.logger.log(`Signup attemp: ${email}`);
    const hash = await bcrypt.hash(password, 10);

    return this.userRepo.create(email, hash, name);
    // return this.usersService.createUser( email, hash, name);
  }

  async validate(email: string, password: string) {
    this.logger.log(`Login attemp: ${email}`);

    const user = await this.userRepo.findByEmail(email);
    if (!user) return null;

    // const valid = await bcrypt.compare(password, user.password);
    const valid = await user.validatePassword(password, bcrypt.compare);
    if (!valid) return null;

    return user;
  }

  async getProfile(userId: number) {
    const user = await this.userRepo.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // remove password before returning
    const { password, ...safeUser } = user;

    return safeUser;
  }
}