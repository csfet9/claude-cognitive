/**
 * CLI semantic command - show/manage semantic memory.
 * @module cli/commands/semantic
 */

import type { CAC } from "cac";
import { Mind } from "../../mind.js";
import { CLIError, ExitCode, output, info } from "../utils/index.js";

interface SemanticOptions {
  project?: string;
  set?: string;
  json?: boolean;
  quiet?: boolean;
}

/**
 * Register the semantic command.
 */
export function registerSemanticCommand(cli: CAC): void {
  cli
    .command("semantic [section]", "Show or manage semantic memory")
    .option("--project <path>", "Project directory (default: current directory)")
    .option("--set <content>", "Set section content (requires section argument)")
    .option("--json", "Output as JSON")
    .option("--quiet", "Suppress output")
    .action(async (section: string | undefined, options: SemanticOptions) => {
      const projectPath = options.project ?? process.cwd();

      const mind = new Mind({ projectPath });
      await mind.init();

      const semantic = mind.getSemanticMemory();
      if (!semantic || !semantic.isLoaded()) {
        throw new CLIError(
          "Semantic memory not loaded.",
          ExitCode.CONFIG_ERROR,
          `Check that ${mind.getSemanticPath()} exists.`,
        );
      }

      // Set section content if --set is provided
      if (options.set !== undefined) {
        if (!section) {
          throw new CLIError(
            "Section name required when using --set.",
            ExitCode.CONFIG_ERROR,
            "Usage: claude-mind semantic 'Section Name' --set 'content'",
          );
        }

        semantic.set(section, options.set);
        await semantic.save();
        info(`Updated section: ${section}`, options);
        return;
      }

      // Show specific section or all
      if (section) {
        const content = semantic.get(section);
        if (content === undefined) {
          throw new CLIError(
            `Section not found: ${section}`,
            ExitCode.CONFIG_ERROR,
            `Available sections: ${semantic.getSectionNames().join(", ")}`,
          );
        }

        if (options.json) {
          output({ section, content }, (d) => d.content, options);
        } else {
          console.log(`## ${section}\n\n${content}`);
        }
      } else {
        // Show all sections
        const sections = semantic.getSectionNames();
        const result: Record<string, string> = {};

        for (const name of sections) {
          const content = semantic.get(name);
          if (content !== undefined) {
            result[name] = content;
          }
        }

        if (options.json) {
          output(result, () => "", options);
        } else {
          console.log(semantic.toContext());
        }
      }
    });
}
