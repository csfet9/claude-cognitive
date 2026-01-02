/**
 * CLI update-bank command - update bank settings.
 * @module cli/commands/update-bank
 */

import type { CAC } from "cac";
import { loadConfig } from "../../config.js";
import { HindsightClient } from "../../client.js";
import type { TraitValue } from "../../types.js";
import { info, warn } from "../utils/index.js";

/** First-person perspective prefix */
const FIRST_PERSON_PREFIX =
  "I am Claude, an AI assistant. I speak in first person (I believe, I noticed, I learned). " +
  "When forming opinions, I say 'I believe...' not 'User believes...'. ";

/**
 * Register the update-bank command.
 */
export function registerUpdateBankCommand(cli: CAC): void {
  cli
    .command("update-bank", "Update bank settings (background, disposition)")
    .option("--fix-perspective", "Fix 'User believes' → 'I believe' issue")
    .option("--background <text>", "Set custom background")
    .option("--skepticism <n>", "Set skepticism (1-5)")
    .option("--literalism <n>", "Set literalism (1-5)")
    .option("--empathy <n>", "Set empathy (1-5)")
    .action(
      async (options: {
        fixPerspective?: boolean;
        background?: string;
        skepticism?: string;
        literalism?: string;
        empathy?: string;
      }) => {
        try {
          const config = await loadConfig(process.cwd());

          const clientOptions: { host: string; port: number; apiKey?: string } = {
            host: config.hindsight?.host ?? "localhost",
            port: config.hindsight?.port ?? 8888,
          };
          if (config.hindsight?.apiKey) {
            clientOptions.apiKey = config.hindsight.apiKey;
          }

          const client = new HindsightClient(clientOptions);

          // Check connection
          const health = await client.health();
          if (!health.healthy) {
            console.error("Error: Hindsight is not available");
            process.exit(1);
          }

          const bankId = config.bankId;
          if (!bankId) {
            console.error("Error: No bankId configured. Run 'claude-cognitive init' first.");
            process.exit(1);
          }

          // Get current bank
          let bank;
          try {
            bank = await client.getBank(bankId);
          } catch {
            console.error(`Error: Bank '${bankId}' not found`);
            process.exit(1);
          }

          const updates: {
            background?: string;
            disposition?: { skepticism?: TraitValue; literalism?: TraitValue; empathy?: TraitValue };
          } = {};

          // Fix perspective
          if (options.fixPerspective) {
            const currentBackground = bank.background ?? "";
            if (!currentBackground.includes("I am Claude")) {
              updates.background = FIRST_PERSON_PREFIX + currentBackground;
              info("Adding first-person perspective to background");
            } else {
              info("Bank already has first-person perspective");
            }
          }

          // Custom background
          if (options.background) {
            updates.background = options.background;
          }

          // Disposition updates
          if (options.skepticism || options.literalism || options.empathy) {
            updates.disposition = {};
            if (options.skepticism) {
              const val = parseInt(options.skepticism, 10);
              if (val >= 1 && val <= 5) {
                updates.disposition.skepticism = val as TraitValue;
              } else {
                warn(`Invalid skepticism value: ${val}. Must be 1-5.`);
              }
            }
            if (options.literalism) {
              const val = parseInt(options.literalism, 10);
              if (val >= 1 && val <= 5) {
                updates.disposition.literalism = val as TraitValue;
              } else {
                warn(`Invalid literalism value: ${val}. Must be 1-5.`);
              }
            }
            if (options.empathy) {
              const val = parseInt(options.empathy, 10);
              if (val >= 1 && val <= 5) {
                updates.disposition.empathy = val as TraitValue;
              } else {
                warn(`Invalid empathy value: ${val}. Must be 1-5.`);
              }
            }
          }

          if (Object.keys(updates).length === 0) {
            info("No updates specified. Use --fix-perspective or other options.");
            console.log("\nOptions:");
            console.log("  --fix-perspective     Fix 'User believes' → 'I believe'");
            console.log("  --background <text>   Set custom background");
            console.log("  --skepticism <1-5>    Update skepticism trait");
            console.log("  --literalism <1-5>    Update literalism trait");
            console.log("  --empathy <1-5>       Update empathy trait");
            return;
          }

          // Apply updates
          await client.updateBank(bankId, updates);

          console.log(`✓ Bank '${bankId}' updated`);

          if (updates.background) {
            const preview = updates.background.length > 80
              ? updates.background.substring(0, 80) + "..."
              : updates.background;
            console.log(`  Background: ${preview}`);
          }
          if (updates.disposition) {
            console.log(`  Disposition: ${JSON.stringify(updates.disposition)}`);
          }
        } catch (error) {
          console.error(
            `Error: ${error instanceof Error ? error.message : error}`,
          );
          process.exit(1);
        }
      },
    );
}
