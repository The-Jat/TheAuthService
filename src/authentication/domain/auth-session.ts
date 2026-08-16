// src/sessions/domain/auth-session.ts

export interface AuthSession {
  id: number;
  user_id: number;
  session_token_hash: string;
  created_at: Date;
  expires_at: Date;
  last_used_at?: Date;
  revoked_at?: Date;
  ip_address?: string;
  user_agent?: string;
}