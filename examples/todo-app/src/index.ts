/**
 * Todo App - Entry Point
 *
 * A simple REST API for managing todos.
 * Demonstrates claude-mind integration.
 */

import express from "express";
import { router } from "./routes.js";

const app = express();
const PORT = process.env.PORT ?? 3000;

// Middleware
app.use(express.json());

// Routes
app.use("/api", router);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Todo API running on http://localhost:${PORT}`);
  console.log(`
Available endpoints:
  GET    /api/todos      - List all todos
  GET    /api/todos/:id  - Get a todo
  POST   /api/todos      - Create a todo
  PATCH  /api/todos/:id  - Update a todo
  DELETE /api/todos/:id  - Delete a todo
  GET    /health         - Health check
  `);
});
