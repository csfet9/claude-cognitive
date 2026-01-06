/**
 * CLI serve command - start the MCP server.
 * @module cli/commands/serve
 */

import type { CAC } from "cac";
import { Mind } from "../../mind.js";
import { ClaudeMindMcpServer, type McpTransportType } from "../../mcp/index.js";
import { CLIError, ExitCode, info } from "../utils/index.js";

interface ServeOptions {
  project?: string;
  transport?: string;
  port?: number;
  host?: string;
  cors?: boolean;
  json?: boolean;
  quiet?: boolean;
}

/**
 * Register the serve command.
 */
export function registerServeCommand(cli: CAC): void {
  cli
    .command("serve", "Start the MCP server")
    .option(
      "--project <path>",
      "Project directory (default: current directory)",
    )
    .option(
      "--transport <type>",
      "Transport type: stdio or http (default: stdio)",
    )
    .option("--port <port>", "HTTP port (default: 3000)", { default: 3000 })
    .option("--host <host>", "HTTP host (default: 127.0.0.1)", {
      default: "127.0.0.1",
    })
    .option("--cors", "Enable CORS for HTTP transport")
    .option("--json", "Output as JSON")
    .option("--quiet", "Suppress output")
    .action(async (options: ServeOptions) => {
      const projectPath = options.project ?? process.cwd();
      const transport = (options.transport ?? "stdio") as McpTransportType;

      if (transport !== "stdio" && transport !== "http") {
        throw new CLIError(
          `Invalid transport: ${transport}. Use 'stdio' or 'http'.`,
          ExitCode.CONFIG_ERROR,
        );
      }

      // Initialize Mind
      const mind = new Mind({ projectPath });
      await mind.init();

      // Start session to enable feedback tracking
      // This sets sessionId which is required for recall tracking
      await mind.onSessionStart();

      if (mind.isDegraded) {
        info(
          "Warning: Running in degraded mode (Hindsight unavailable). Memory tools will return limited results.",
          options,
        );
      }

      // Create and start server
      const httpConfig: { port?: number; host?: string; cors?: boolean } = {};
      if (options.port !== undefined) httpConfig.port = options.port;
      if (options.host !== undefined) httpConfig.host = options.host;
      if (options.cors !== undefined) httpConfig.cors = options.cors;

      const server = new ClaudeMindMcpServer({
        mind,
        transport,
        http: httpConfig,
      });

      await server.start();

      // Keep process running
      process.on("SIGINT", async () => {
        info("\nShutting down...", options);
        await mind.onSessionEnd();
        await server.stop();
        process.exit(0);
      });

      process.on("SIGTERM", async () => {
        await mind.onSessionEnd();
        await server.stop();
        process.exit(0);
      });
    });
}
