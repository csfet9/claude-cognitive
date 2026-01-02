/**
 * Database layer using SQLite.
 */

import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { Todo, CreateTodoRequest, UpdateTodoRequest } from "./types.js";

// Initialize database
const db = new Database("todos.db");

// Run migrations
db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    completed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

/**
 * Get all todos.
 */
export function getAllTodos(): Todo[] {
  const stmt = db.prepare(`
    SELECT id, title, description, completed, created_at, updated_at
    FROM todos
    ORDER BY created_at DESC
  `);

  return stmt.all().map(rowToTodo);
}

/**
 * Get a single todo by ID.
 */
export function getTodoById(id: string): Todo | null {
  const stmt = db.prepare(`
    SELECT id, title, description, completed, created_at, updated_at
    FROM todos
    WHERE id = ?
  `);

  const row = stmt.get(id);
  return row ? rowToTodo(row) : null;
}

/**
 * Create a new todo.
 */
export function createTodo(data: CreateTodoRequest): Todo {
  const id = randomUUID();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO todos (id, title, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(id, data.title, data.description ?? null, now, now);

  return {
    id,
    title: data.title,
    description: data.description ?? null,
    completed: false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update an existing todo.
 */
export function updateTodo(id: string, data: UpdateTodoRequest): Todo | null {
  const existing = getTodoById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updates: string[] = ["updated_at = ?"];
  const values: unknown[] = [now];

  if (data.title !== undefined) {
    updates.push("title = ?");
    values.push(data.title);
  }
  if (data.description !== undefined) {
    updates.push("description = ?");
    values.push(data.description);
  }
  if (data.completed !== undefined) {
    updates.push("completed = ?");
    values.push(data.completed ? 1 : 0);
  }

  values.push(id);

  const stmt = db.prepare(`
    UPDATE todos
    SET ${updates.join(", ")}
    WHERE id = ?
  `);

  stmt.run(...values);

  return getTodoById(id);
}

/**
 * Delete a todo.
 */
export function deleteTodo(id: string): boolean {
  const stmt = db.prepare("DELETE FROM todos WHERE id = ?");
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Convert database row to Todo object.
 */
function rowToTodo(row: unknown): Todo {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    title: r.title as string,
    description: r.description as string | null,
    completed: Boolean(r.completed),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}
