import { UserRepository } from "../repository/user.repository";
import type { UserRecord } from "../db/database";


export class UserService {

  constructor(private readonly userRepository: UserRepository) {}

  async getUser(userId: string): Promise<UserRecord | null> {
    return this.userRepository.getUser(userId);
  }

  async createUser(userId: string, provider: string, model: string | null, apiKeyEncrypted: string): Promise<void> {
    return this.userRepository.upsertUser(userId, provider, model, apiKeyEncrypted)
  }

  async deleteUser(userId: string): Promise<void> {
    return this.userRepository.deleteUser(userId);
  }
}
