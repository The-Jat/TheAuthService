import { Inject, Injectable } from '@nestjs/common';
import type { UserRepository } from './interfaces/user.repository';

@Injectable()
export class UsersService {
  constructor(
    @Inject('UserRepository')
    private userRepo: UserRepository,
  ) {}

    createUser(email: string, password: string, name: string) {
        return this.userRepo.create(email, password, name);
    }

    findByEmail(email: string) {
        return this.userRepo.findByEmail(email);
    }

    findById(id: number) {
        return this.userRepo.findById(id);
    }
}