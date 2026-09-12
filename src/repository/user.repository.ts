
import databaseService from "../db/database";
import type { UserRecord } from "../db/database";

export class UserRepository {

  constructor(private readonly db = databaseService) {}

  getUser(userId: string): UserRecord | null {
    return this.db.getUser(userId);
  }

  // Insertamos o actualizamos un usuario
  upsertUser(userId: string, provider: string, model: string | null, apiKeyEncrypted: string) {
    this.db.upsertUser(userId, provider, model, apiKeyEncrypted);
  }

  // Eliminamos un usuario
  deleteUser(userId: string) {
    this.db.deleteUser(userId);
  }
}

export default new UserRepository();
