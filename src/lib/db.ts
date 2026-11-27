import Database from "./accessDatabase";

let database: Promise<Database> | undefined;

export function getDatabase(): Promise<Database> {
  if (!database) {
    database = Database.load("sqlite:near.db");
  }

  return database;
}