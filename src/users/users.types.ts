export type Role = 'user' | 'admin';
export type UserStatus = 'active' | 'disabled';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  email_verified_at: Date | null;
  failed_logins: number;
  locked_until: Date | null;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** The shape every API returns; never includes lockout counters or hashes. */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    emailVerified: !!u.email_verified_at,
    lastLoginAt: u.last_login_at ? u.last_login_at.toISOString() : null,
    createdAt: u.created_at.toISOString(),
  };
}
