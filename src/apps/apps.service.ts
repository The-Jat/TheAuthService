import { Inject, Injectable } from '@nestjs/common';
import type { AppRepository } from './interfaces/app.repository';

@Injectable()
export class AppsService {
    constructor(
        @Inject('AppRepository')
        private appRepo: AppRepository,
    ) { }

    findByClientId(clientId: string) {
        return this.appRepo.findByClientId(clientId);
    }

    parseScopes(scopes: string): string[] {
        return scopes ? scopes.split(',') : [];
    }
}