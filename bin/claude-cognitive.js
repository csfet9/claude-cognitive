#!/usr/bin/env node

// CLI entry point for claude-cognitive
// This file is the bin entry that gets executed when running `claude-cognitive` or `npx claude-cognitive`

import("../dist/cli/index.js").catch((error) => {
  console.error("Failed to load claude-cognitive CLI:", error.message);
  process.exit(1);
});
