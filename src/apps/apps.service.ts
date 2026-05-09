import { Inject, Injectable } from '@nestjs/common';
import type { AppRepository } from './domain/app.repository';

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

    createApp(
        userId: number,
        name: string,
        redirectUri: string,
        scopes: string,
    ) {
        return this.appRepo.create({
            user_id: userId,
            name,
            redirect_uri: redirectUri,
            scopes,
        });
    }
}