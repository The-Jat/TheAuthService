import { Inject, Injectable } from '@nestjs/common';
import type { ApiKeyRepository } from './interfaces/api-key.repository';

@Injectable()
export class ApiKeysService {
    constructor(
        @Inject('ApiKeyRepository')
        private apiKeyRepo: ApiKeyRepository
    ) { }

    findKey(key: string) {
        return this.apiKeyRepo.findKey(key);
    }
}