import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";

// Preserve SQL-plugin migrations and the existing SQLite locations, while all
// application reads and writes pass through the Rust access guard.
export default class AccessDatabase {
  private constructor(private readonly db: string) {}
  static async load(db: string, options?: { autoCreate?: boolean }) {
    await Database.load(db, options);
    return new AccessDatabase(db);
  }
  select<T>(query: string, values: unknown[] = []): Promise<T> {
    return invoke("db_select", { db: this.db, query, values });
  }
  execute(query: string, values: unknown[] = []): Promise<{ rowsAffected: number; lastInsertId: number }> {
    return invoke("db_execute", { db: this.db, query, values });
  }
  async close() { return true; }
}
