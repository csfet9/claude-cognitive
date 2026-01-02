/**
 * API routes for todo operations.
 */

import { Router } from "express";
import * as db from "./db.js";
import type { CreateTodoRequest, UpdateTodoRequest } from "./types.js";

export const router = Router();

/**
 * GET /todos - List all todos
 */
router.get("/todos", (_req, res) => {
  const todos = db.getAllTodos();
  res.json(todos);
});

/**
 * GET /todos/:id - Get a single todo
 */
router.get("/todos/:id", (req, res) => {
  const todo = db.getTodoById(req.params.id);

  if (!todo) {
    res.status(404).json({ error: "Todo not found" });
    return;
  }

  res.json(todo);
});

/**
 * POST /todos - Create a new todo
 */
router.post("/todos", (req, res) => {
  const body = req.body as CreateTodoRequest;

  if (!body.title || typeof body.title !== "string") {
    res.status(400).json({ error: "Title is required" });
    return;
  }

  const todo = db.createTodo({
    title: body.title.trim(),
    description: body.description?.trim(),
  });

  res.status(201).json(todo);
});

/**
 * PATCH /todos/:id - Update a todo
 */
router.patch("/todos/:id", (req, res) => {
  const body = req.body as UpdateTodoRequest;
  const todo = db.updateTodo(req.params.id, body);

  if (!todo) {
    res.status(404).json({ error: "Todo not found" });
    return;
  }

  res.json(todo);
});

/**
 * DELETE /todos/:id - Delete a todo
 */
router.delete("/todos/:id", (req, res) => {
  const deleted = db.deleteTodo(req.params.id);

  if (!deleted) {
    res.status(404).json({ error: "Todo not found" });
    return;
  }

  res.status(204).send();
});
