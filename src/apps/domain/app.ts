export class App {
  constructor(
    public id: number,
    public client_id: string,
    public client_secret: string,
    public redirect_uri: string,
    public scopes: string,
  ) {}
}