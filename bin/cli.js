#!/usr/bin/env node

/**
 * claude-mind CLI
 */

import { Mind } from '../src/index.js';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  const mind = new Mind();

  switch (command) {
    case 'status':
      await status(mind);
      break;

    case 'search':
      await search(mind, args.slice(1).join(' '));
      break;

    case 'recent':
      const days = parseInt(args[1]) || 7;
      await recent(mind, days);
      break;

    case 'cleanup':
      await cleanup(mind);
      break;

    case 'forget':
      await forget(mind, args[1]);
      break;

    case 'semantic':
      await semantic(mind);
      break;

    default:
      showHelp();
  }
}

async function status(mind) {
  console.log('claude-mind status\n');

  try {
    await mind.init();
    console.log('✓ Hindsight connected');
  } catch (error) {
    console.log('✗ Hindsight unavailable:', error.message);
  }

  console.log(`\nProject: ${mind.config.hindsight.bankId}`);
  console.log(`Semantic: ${mind.config.semantic.path}`);
}

async function search(mind, query) {
  if (!query) {
    console.log('Usage: claude-mind search <query>');
    return;
  }

  await mind.init();
  const results = await mind.search(query);

  console.log(`Found ${results.length} memories:\n`);
  for (const result of results) {
    console.log(`[${result.type}] ${result.content}`);
    console.log(`  Strength: ${(result.strength * 100).toFixed(0)}%\n`);
  }
}

async function recent(mind, days) {
  await mind.init();
  const results = await mind.recent(days);

  console.log(`Recent memories (${days} days):\n`);
  for (const result of results) {
    console.log(`[${result.type}] ${result.content}`);
  }
}

async function cleanup(mind) {
  await mind.init();
  const result = await mind.cleanup();

  console.log(`Cleanup complete:`);
  console.log(`  Forgotten: ${result.forgotten}`);
  console.log(`  Promoted: ${result.promoted}`);
}

async function forget(mind, id) {
  if (!id) {
    console.log('Usage: claude-mind forget <id>');
    return;
  }

  await mind.init();
  await mind.remove(id);
  console.log(`Forgotten: ${id}`);
}

async function semantic(mind) {
  await mind.init();
  const context = await mind.onSessionStart();

  console.log('Semantic Memory:\n');
  console.log(context);
}

function showHelp() {
  console.log(`
claude-mind - Human-inspired memory for Claude

Usage:
  claude-mind <command> [options]

Commands:
  status              Check connection and show config
  search <query>      Search memories
  recent [days]       Show recent memories (default: 7 days)
  cleanup             Run decay and cleanup
  forget <id>         Remove specific memory
  semantic            Show semantic memory content

LLM thinks. Hindsight remembers. Together = mind.
  `);
}

main().catch(console.error);
