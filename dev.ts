#!/usr/bin/env bun
// Dev entry — runs CLI directly from TypeScript source, no build needed.
// Usage: bun dev.ts [args...]
//   or via bun link: autoagents [args...]
import './scripts/dev-preload.ts'
import './src/entrypoints/cli.tsx'
