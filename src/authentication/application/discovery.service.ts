// src/authentication/application/discovery.service.ts

import { Injectable, Inject } from '@nestjs/common';
import type { CredentialRepository } from '../domain/credential.repository';

@Injectable()
export class DiscoveryService {

  constructor(
    @Inject('CredentialRepository')
    private readonly credentialRepo: CredentialRepository,
  ) {}

  async discover(email: string) {

    return await this.credentialRepo.findMethodsByEmail(email);
  }
}