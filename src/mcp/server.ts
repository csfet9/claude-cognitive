/**
 * MCP server implementation for claude-cognitive.
 * @module mcp/server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express, { type Express, type Request, type Response } from "express";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import type { Mind } from "../mind.js";
import { loadConfig } from "../config.js";
import { handleRecall, handleReflect } from "./handlers.js";
import {
  TOOL_DEFINITIONS,
  recallInputSchema,
  reflectInputSchema,
} from "./tools.js";
import type {
  HttpTransportConfig,
  McpServerOptions,
  McpTransportType,
} from "./types.js";

// ============================================
// Constants
// ============================================

/** Default server configuration */
const DEFAULTS = {
  name: "claude-cognitive",
  version: "0.1.0",
  httpPort: 3000,
  httpHost: "127.0.0.1",
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
};

// ============================================
// Server Class
// ============================================

/**
 * ClaudeMindMcpServer wraps the MCP SDK and provides memory tools.
 *
 * Supports both STDIO and HTTP transports for flexible deployment:
 * - STDIO: For local CLI integration with Claude Code
 * - HTTP: For remote/networked deployments and testing
 *
 * @example
 * ```typescript
 * const mind = new Mind({ projectPath: '/path/to/project' });
 * await mind.init();
 *
 * const server = new ClaudeMindMcpServer({
 *   mind,
 *   transport: 'stdio',
 * });
 *
 * await server.start();
 * ```
 */
export class ClaudeMindMcpServer {
  private readonly mind: Mind;
  private readonly transportType: McpTransportType;
  private readonly serverName: string;
  private readonly serverVersion: string;
  private readonly httpConfig: Required<HttpTransportConfig>;
  private readonly projectPath: string;

  private mcpServer: McpServer | null = null;
  private httpServer: Server | null = null;
  private expressApp: Express | null = null;
  private running = false;

  constructor(options: McpServerOptions) {
    this.mind = options.mind;
    this.transportType = options.transport ?? "stdio";
    this.serverName = options.name ?? DEFAULTS.name;
    this.serverVersion = options.version ?? DEFAULTS.version;
    this.httpConfig = {
      port: options.http?.port ?? DEFAULTS.httpPort,
      host: options.http?.host ?? DEFAULTS.httpHost,
      cors: options.http?.cors ?? false,
      sessionTimeout: options.http?.sessionTimeout ?? DEFAULTS.sessionTimeout,
    };
    this.projectPath = this.mind.getProjectPath();
  }

  /**
   * Start the MCP server.
   *
   * @throws {Error} If server is already running
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error("MCP server is already running");
    }

    // Load config (for future use)
    await loadConfig(this.projectPath);

    // Create and configure MCP server
    this.mcpServer = new McpServer({
      name: this.serverName,
      version: this.serverVersion,
    });

    // Register tools
    this.registerTools();

    // Connect transport
    if (this.transportType === "stdio") {
      await this.startStdioTransport();
    } else {
      await this.startHttpTransport();
    }

    this.running = true;
  }

  /**
   * Stop the MCP server.
   *
   * Always cleans up state even if close fails.
   * Throws after cleanup if there was an error.
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    let closeError: Error | null = null;

    if (this.httpServer) {
      try {
        await new Promise<void>((resolve, reject) => {
          this.httpServer!.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      } catch (err) {
        closeError = err instanceof Error ? err : new Error(String(err));
      }
      this.httpServer = null;
      this.expressApp = null;
    }

    this.mcpServer = null;
    this.running = false;

    // Re-throw error after cleanup is complete
    if (closeError) throw closeError;
  }

  /**
   * Check if the server is running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get the transport type.
   */
  getTransportType(): McpTransportType {
    return this.transportType;
  }

  /**
   * Get the HTTP port (only relevant for HTTP transport).
   */
  getHttpPort(): number {
    return this.httpConfig.port;
  }

  /**
   * Get the HTTP host (only relevant for HTTP transport).
   */
  getHttpHost(): string {
    return this.httpConfig.host;
  }

  /**
   * Register memory tools with the MCP server.
   */
  private registerTools(): void {
    if (!this.mcpServer) return;

    // Register memory_recall
    this.mcpServer.tool(
      TOOL_DEFINITIONS.memory_recall.name,
      TOOL_DEFINITIONS.memory_recall.description,
      {
        query: recallInputSchema.shape.query,
        type: recallInputSchema.shape.type,
      },
      async (args) => {
        // Validate input with Zod for type safety
        const parsed = recallInputSchema.safeParse({
          query: args.query,
          ...(args.type ? { type: args.type } : {}),
        });

        if (!parsed.success) {
          return {
            content: [
              { type: "text", text: `Invalid input: ${parsed.error.message}` },
            ],
            isError: true,
          };
        }

        // Build input without undefined values (exactOptionalPropertyTypes compliance)
        const input: {
          query: string;
          type?: "world" | "experience" | "opinion" | "all";
        } = {
          query: parsed.data.query,
        };
        if (parsed.data.type) {
          input.type = parsed.data.type;
        }

        const result = await handleRecall(this.mind, input);
        return {
          content: result.content,
          ...(result.isError ? { isError: result.isError } : {}),
        };
      },
    );

    // Register memory_reflect
    this.mcpServer.tool(
      TOOL_DEFINITIONS.memory_reflect.name,
      TOOL_DEFINITIONS.memory_reflect.description,
      {
        query: reflectInputSchema.shape.query,
      },
      async (args) => {
        // Validate input with Zod for type safety
        const parsed = reflectInputSchema.safeParse({
          query: args.query,
        });

        if (!parsed.success) {
          return {
            content: [
              { type: "text", text: `Invalid input: ${parsed.error.message}` },
            ],
            isError: true,
          };
        }

        const result = await handleReflect(this.mind, {
          query: parsed.data.query,
        });
        return {
          content: result.content,
          ...(result.isError ? { isError: result.isError } : {}),
        };
      },
    );
  }

  /**
   * Start STDIO transport.
   */
  private async startStdioTransport(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.mcpServer!.connect(transport);

    // Log to stderr (not stdout, which is used for MCP)
    console.error(
      `${this.serverName} MCP server started (STDIO transport, v${this.serverVersion})`,
    );
  }

  /**
   * Start HTTP transport with Express.
   *
   * Note: The MCP SDK's StreamableHTTPServerTransport is still experimental.
   * For now, we implement a simple JSON-RPC endpoint.
   */
  private async startHttpTransport(): Promise<void> {
    this.expressApp = express();
    this.expressApp.use(express.json({ limit: "100kb" }));

    // Add security headers
    this.expressApp.use((_req: Request, res: Response, next) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader("X-XSS-Protection", "1; mode=block");
      next();
    });

    // WARNING: cors: true enables Access-Control-Allow-Origin: *
    // This allows any website to make requests. Use with caution.
    // For production, consider implementing origin allowlisting.
    if (this.httpConfig.cors) {
      this.expressApp.use((_req: Request, res: Response, next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header(
          "Access-Control-Allow-Methods",
          "GET, POST, DELETE, OPTIONS",
        );
        res.header(
          "Access-Control-Allow-Headers",
          "Content-Type, mcp-session-id",
        );
        if (_req.method === "OPTIONS") {
          res.sendStatus(200);
          return;
        }
        next();
      });
    }

    // Health check endpoint
    this.expressApp.get("/health", (_req: Request, res: Response) => {
      res.json({
        status: "ok",
        server: this.serverName,
        version: this.serverVersion,
        degraded: this.mind.isDegraded,
      });
    });

    // Tools listing endpoint (for debugging)
    this.expressApp.get("/tools", (_req: Request, res: Response) => {
      res.json({
        tools: [
          {
            name: TOOL_DEFINITIONS.memory_recall.name,
            description: TOOL_DEFINITIONS.memory_recall.description,
          },
          {
            name: TOOL_DEFINITIONS.memory_reflect.name,
            description: TOOL_DEFINITIONS.memory_reflect.description,
          },
        ],
      });
    });

    // Tool execution endpoint (simple JSON-RPC style)
    this.expressApp.post(
      "/tools/:name",
      async (req: Request, res: Response) => {
        const toolName = req.params.name;
        const sessionId =
          (req.headers["mcp-session-id"] as string) || randomUUID();

        try {
          if (toolName === "memory_recall") {
            const parsed = recallInputSchema.safeParse(req.body);
            if (!parsed.success) {
              res.status(400).json({
                error: "Invalid input",
                details: parsed.error.errors,
              });
              return;
            }
            const input = {
              query: parsed.data.query,
              ...(parsed.data.type ? { type: parsed.data.type } : {}),
            };
            const result = await handleRecall(this.mind, input);
            res.json({ sessionId, ...result });
          } else if (toolName === "memory_reflect") {
            const parsed = reflectInputSchema.safeParse(req.body);
            if (!parsed.success) {
              res.status(400).json({
                error: "Invalid input",
                details: parsed.error.errors,
              });
              return;
            }
            const result = await handleReflect(this.mind, parsed.data);
            res.json({ sessionId, ...result });
          } else {
            res.status(404).json({ error: `Unknown tool: ${toolName}` });
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          res.status(500).json({ error: message });
        }
      },
    );

    // Start listening
    await new Promise<void>((resolve) => {
      this.httpServer = this.expressApp!.listen(
        this.httpConfig.port,
        this.httpConfig.host,
        () => {
          console.error(
            `${this.serverName} MCP server started (HTTP transport, v${this.serverVersion}) at http://${this.httpConfig.host}:${this.httpConfig.port}`,
          );
          resolve();
        },
      );
    });
  }
}
