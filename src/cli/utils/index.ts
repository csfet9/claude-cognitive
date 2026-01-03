/**
 * CLI utility exports.
 * @module cli/utils
 */

export {
  CLIError,
  ExitCode,
  handleError,
  withErrorHandling,
} from "./errors.js";
export type { ExitCode as ExitCodeType } from "./errors.js";

export {
  output,
  info,
  warn,
  formatMemories,
  formatOpinions,
  formatStatus,
  formatLearnResult,
  formatConfig,
} from "./output.js";
export type { OutputOptions } from "./output.js";
