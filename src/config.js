/**
 * Configuration loading
 */

import { readFileSync, existsSync } from 'fs';
import { join, basename } from 'path';

const DEFAULT_CONFIG = {
  hindsight: {
    host: 'localhost',
    port: 8888,
    bankId: null, // Will be set to project name
  },
  semantic: {
    path: '.claude/memory.md',
    maxLines: 100,
  },
  episodic: {
    maxActive: 50,
    decayRate: 0.1,
  },
  consolidation: {
    minImportance: 0.5,
    abstractionLevel: 'essence',
  },
  cleanup: {
    forgetThreshold: 0.2,
    promoteThreshold: 0.5,
    runAfterSession: true,
  },
};

/**
 * Load configuration from various sources
 */
export function loadConfig(projectPath, overrides = {}) {
  let config = { ...DEFAULT_CONFIG };

  // Try to load from .claudemindrc
  const rcPath = join(projectPath, '.claudemindrc');
  if (existsSync(rcPath)) {
    try {
      const rcContent = readFileSync(rcPath, 'utf-8');
      const rcConfig = JSON.parse(rcContent);
      config = mergeConfig(config, rcConfig);
    } catch (error) {
      // Ignore parse errors, use defaults
    }
  }

  // Try to load from package.json
  const pkgPath = join(projectPath, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkgContent = readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);
      if (pkg.claudemind) {
        config = mergeConfig(config, pkg.claudemind);
      }

      // Use package name as default bankId
      if (!config.hindsight.bankId && pkg.name) {
        config.hindsight.bankId = pkg.name;
      }
    } catch (error) {
      // Ignore parse errors
    }
  }

  // Apply overrides
  config = mergeConfig(config, overrides);

  // Fallback bankId to folder name
  if (!config.hindsight.bankId) {
    config.hindsight.bankId = basename(projectPath);
  }

  // Resolve semantic path
  if (!config.semantic.path.startsWith('/')) {
    config.semantic.path = join(projectPath, config.semantic.path);
  }

  return config;
}

function mergeConfig(base, override) {
  const result = { ...base };

  for (const key of Object.keys(override)) {
    if (
      typeof override[key] === 'object' &&
      override[key] !== null &&
      !Array.isArray(override[key])
    ) {
      result[key] = mergeConfig(base[key] || {}, override[key]);
    } else {
      result[key] = override[key];
    }
  }

  return result;
}
