/**
 * Shared TypeScript types for the todo app.
 */

/**
 * Todo item stored in the database.
 */
export interface Todo {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Request body for creating a todo.
 */
export interface CreateTodoRequest {
  title: string;
  description?: string;
}

/**
 * Request body for updating a todo.
 */
export interface UpdateTodoRequest {
  title?: string;
  description?: string;
  completed?: boolean;
}

/**
 * API error response.
 */
export interface ErrorResponse {
  error: string;
}
