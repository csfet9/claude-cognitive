/**
 * CLI entry point for claude-cognitive.
 * @module cli
 */

import { cac, type CAC } from "cac";
import { handleError } from "./utils/index.js";
import {
  registerInitCommand,
  registerInstallCommand,
  registerUninstallCommand,
  registerServeCommand,
  registerStatusCommand,
  registerLearnCommand,
  registerRecallCommand,
  registerReflectCommand,
  registerSemanticCommand,
  registerConfigCommand,
  registerUpdateBankCommand,
  registerSyncCommand,
  registerSyncSessionCommand,
  registerUpdateCommand,
} from "./commands/index.js";
import { registerInjectContextCommand } from "../hooks/inject-context.js";
import { registerProcessSessionCommand } from "../hooks/process-session.js";
import { registerBufferMessageCommand } from "../hooks/buffer-message.js";

// Get version from package.json
const VERSION = "0.2.4";

/**
 * Create and configure the CLI.
 */
function createCLI(): CAC {
  const cli = cac("claude-cognitive");

  // Register commands
  registerInitCommand(cli);
  registerInstallCommand(cli);
  registerUninstallCommand(cli);
  registerServeCommand(cli);
  registerStatusCommand(cli);
  registerLearnCommand(cli);
  registerRecallCommand(cli);
  registerReflectCommand(cli);
  registerSemanticCommand(cli);
  registerConfigCommand(cli);
  registerUpdateBankCommand(cli);
  registerSyncCommand(cli);
  registerSyncSessionCommand(cli);
  registerUpdateCommand(cli);

  // Register hook commands
  registerInjectContextCommand(cli);
  registerProcessSessionCommand(cli);
  registerBufferMessageCommand(cli);

  // Global help
  cli.help();

  // Version
  cli.version(VERSION);

  return cli;
}

/**
 * Run the CLI.
 */
async function main(): Promise<void> {
  const cli = createCLI();

  try {
    cli.parse(process.argv, { run: false });
    await cli.runMatchedCommand();
  } catch (error) {
    handleError(error);
  }
}

// Run if this is the main module
main().catch((error) => {
  handleError(error);
});
