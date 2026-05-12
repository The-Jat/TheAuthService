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
    private jwtService: JwtService,

    @Inject('TokenRepository')
    private tokenRepo: TokenRepository,

    @Inject('BlacklistRepository')
    private blacklistRepo: BlacklistRepository,

    @Inject('CodeRepository')
    private codeRepo: CodeRepository,
  ) { }

}