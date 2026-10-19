export interface Session {
  id: string;
  user_id: string;
  token_hash: string;
  ip: string | null;
  user_agent: string | null;
  auth_method: string;
  created_at: Date;
  last_used_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
}

export interface PublicSession {
  id: string;
  ip: string | null;
  userAgent: string | null;
  authMethod: string;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}
