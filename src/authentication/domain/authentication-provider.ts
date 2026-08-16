import { User } from 'src/users/domain/user';
import { AuthProviderType } from './auth-provider.types';

// export interface AuthenticationProvider<TPayload = unknown> {
//   authenticate(payload: TPayload): Promise<User | null>;
// }

export interface AuthenticationProvider <TRequest = any,> {
    type(): AuthProviderType;

    authenticate(
        request: TRequest,
    ): Promise<User | null>;
}