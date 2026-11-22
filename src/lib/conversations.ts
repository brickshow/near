import { getDatabase } from "./db";
import type { ChatTurn } from "./chat";

export type ConversationSummary = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export async function listConversations(): Promise<ConversationSummary[]> {
  const database = await getDatabase();
  return database.select<ConversationSummary[]>(
    "SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC, id DESC",
  );
}

export async function loadConversation(id: string): Promise<ChatTurn[]> {
  const database = await getDatabase();
  return database.select<ChatTurn[]>(
    "SELECT role, content FROM conversation_messages WHERE conversation_id = $1 ORDER BY id ASC",
    [id],
  );
}

export async function createConversation(): Promise<ConversationSummary> {
  const database = await getDatabase();
  const id = crypto.randomUUID();
  await database.execute(
    "INSERT INTO conversations (id, updated_at) VALUES ($1, strftime('%Y-%m-%d %H:%M:%f', 'now'))",
    [id],
  );
  const [conversation] = await database.select<ConversationSummary[]>(
    "SELECT id, title, created_at, updated_at FROM conversations WHERE id = $1",
    [id],
  );
  return conversation;
}

export async function saveConversationMessage(id: string, turn: ChatTurn): Promise<void> {
  const database = await getDatabase();
  await database.execute(
    "INSERT INTO conversation_messages (conversation_id, role, content) VALUES ($1, $2, $3)",
    [id, turn.role, turn.content],
  );
  await database.execute(
    "UPDATE conversations SET title = CASE WHEN title = 'New conversation' AND $2 = 'user' THEN substr($3, 1, 48) ELSE title END, updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now') WHERE id = $1",
    [id, turn.role, turn.content],
  );
}

export async function deleteConversation(id: string): Promise<void> {
  const database = await getDatabase();
  await database.execute("DELETE FROM conversation_messages WHERE conversation_id = $1", [id]);
  await database.execute("DELETE FROM conversations WHERE id = $1", [id]);
}
