export interface UserRepository {
  create(email: string, password: string, name: string): Promise<any>;
  findByEmail(email: string): Promise<any>;
  findById(id: number): Promise<any>;
}