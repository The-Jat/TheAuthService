export class User {
  constructor(
    public id: number,
    public email: string,
    public password: string,
    public name: string,
    public role: string,
  ) {}

  validatePassword(password: string, compareFn: (a: string, b: string) => Promise<boolean>) {
    return compareFn(password, this.password);
  }
}