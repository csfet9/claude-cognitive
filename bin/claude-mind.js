#!/usr/bin/env node

// CLI entry point for claude-mind
// This file is the bin entry that gets executed when running `claude-mind` or `npx claude-mind`

import("../dist/cli/index.js").catch((error) => {
  console.error("Failed to load claude-mind CLI:", error.message);
  process.exit(1);
});
