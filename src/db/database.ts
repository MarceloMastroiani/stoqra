import { Database } from "bun:sqlite";

export interface UserRecord {
  user_id: string;
  provider: string;
  model: string | null;
  api_key_encrypted: string;
  created_at: string;
  updated_at: string;
}

class DatabaseService {
  private db: Database;

  constructor() {
    this.db = new Database("stoqra.db");

    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        model TEXT,
        api_key_encrypted TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  getUser(userId: string): UserRecord | null {
    return this.db
      .query<UserRecord, [string]>("SELECT * FROM users WHERE user_id = ?")
      .get(userId);
  }

  upsertUser(userId: string, provider: string, model: string | null, apiKeyEncrypted: string): void {
    this.db.run(
      `INSERT INTO users (user_id, provider, model, api_key_encrypted)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         provider = excluded.provider,
         model = excluded.model,
         api_key_encrypted = excluded.api_key_encrypted,
         updated_at = datetime('now')`,
      [userId, provider, model, apiKeyEncrypted]
    );
  }

  deleteUser(userId: string): void {
    this.db.run("DELETE FROM users WHERE user_id = ?", [userId]);
  }
}

export default new DatabaseService();
