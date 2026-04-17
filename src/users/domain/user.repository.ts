import { User } from "./user";

export interface UserRepository {
  create(email: string, password: string, name: string): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: number): Promise<User | null>;
}