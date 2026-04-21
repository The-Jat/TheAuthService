export class AuthCode {
  constructor(
    public code: string,
    public user_id: number,
    public client_id: string,
    public redirect_uri: string,
    public expires_at: Date,
  ) {}
}