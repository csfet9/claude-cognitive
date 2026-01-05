# Project Memory

## Tech Stack

- TypeScript 5.x with strict mode
- Node.js 18+ runtime
- Express 4.x for HTTP API
- SQLite with better-sqlite3 driver
- Vitest for testing

## Key Decisions

- REST API design with standard HTTP methods
- SQLite chosen for simplicity (single-file database)
- Synchronous database operations for simpler code
- ISO 8601 date strings for timestamps
- UUIDs for todo IDs

## Critical Paths

- `src/index.ts` - Application entry point and server setup
- `src/db.ts` - Database connection and migrations
- `src/routes.ts` - API endpoint definitions
- `src/types.ts` - Shared TypeScript interfaces

## API Patterns

- GET /todos - List all todos
- GET /todos/:id - Get single todo
- POST /todos - Create todo (body: { title, description? })
- PATCH /todos/:id - Update todo (body: partial todo)
- DELETE /todos/:id - Delete todo

## Error Handling

- 400 for validation errors (missing title, invalid ID format)
- 404 for not found resources
- 500 for unexpected server errors
- All errors return { error: string } JSON body

## Observations

<!-- High-confidence insights promoted from Hindsight will appear here -->

## Feedback Stats

<!-- Memory usefulness metrics tracked by the feedback loop -->

- Feedback loop: enabled
- Signal types: used, ignored, helpful, not_helpful
- Usefulness boosting: enabled (weight: 0.3)
