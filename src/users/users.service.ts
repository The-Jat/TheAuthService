import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { UserRepository } from './domain/user.repository';
import { Logger } from '@nestjs/common';
import { EventBusService } from 'src/core/events/application/event-bus.service';
import { CentralLoggerService } from 'src/core/logger/application/central-logger.service';

@Injectable()
export class UsersService {
    // private logger = new Logger(UsersService.name);
  constructor(
    @Inject('UserRepository')
    private userRepo: UserRepository,
    private eventBus: EventBusService,
    private centralLogger: CentralLoggerService,
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

    async signup(email: string, password: string, name: string) {
        // this.logger.log(`Signup attemp: ${email}`);
    
        const existingUser = await this.userRepo.findByEmail(email);
        if (existingUser) {
        //   this.logger.log(`Email already exists`);
          throw new UnauthorizedException('Email already exist');
        }
    
        const hash = await bcrypt.hash(password, 10);

        // CREATE USER FIRST
        const user =
            await this.userRepo.create(
                email,
                hash,
                name,
            );

        // THEN EMIT EVENT
        await this.eventBus.publish({
            event: 'auth.user.created',

            timestamp:
                new Date().toISOString(),

            service: 'auth-service',

            data: {
                userId: user.id,
                email: user.email,
                name: user.name,
            },
        });


        await this.centralLogger.info(
            `User signup success`,
            {
                userId: user.id,
                email: user.email,
            },
        );

        return user;
      }
    
      async validate(email: string, password: string) {
        // this.logger.log(`Login attemp: ${email}`);
    
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