export class App {
  constructor(
    public id: number,
    public user_id: number,
    public name: string,
    public client_id: string,
    public client_secret: string,
    public redirect_uri: string,
    public scopes: string,
    public created_at: Date,
  ) {}
}