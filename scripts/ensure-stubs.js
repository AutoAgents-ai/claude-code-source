// Creates stub packages in node_modules for internal Anthropic deps
// that aren't available on npm. These are behind feature() gates and
// dead-code-eliminated in external builds, but bun needs to resolve them.
//
// Each stub exports the exact shapes needed by the importing code.

import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const nodeModules = join(import.meta.dirname, '..', 'node_modules')

function writeStub(pkgPath, pkgJson, code) {
  const dir = join(nodeModules, ...pkgPath.split('/'))
  if (existsSync(join(dir, 'package.json'))) return
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkgJson, null, 2))
  writeFileSync(join(dir, 'index.mjs'), code)
}

// @anthropic-ai/sandbox-runtime — needs SandboxManager class, SandboxRuntimeConfigSchema, SandboxViolationStore
writeStub('@anthropic-ai/sandbox-runtime', {
  name: '@anthropic-ai/sandbox-runtime', version: '0.0.0-stub', type: 'module', main: 'index.mjs',
  exports: { '.': { import: './index.mjs', default: './index.mjs' } },
}, `
const noop = () => {};
const noopAsync = async () => {};
const noopProxy = new Proxy({}, { get: () => noop });

export class SandboxManager {
  static checkDependencies() { return { satisfied: false }; }
  static isSupportedPlatform() { return false; }
  static getFsReadConfig() { return {}; }
  static getFsWriteConfig() { return {}; }
  static getNetworkConfig() { return {}; }
  static wrapWithSandbox(cmd, args) { return { cmd, args }; }
  static async initialize() {}
  static updateConfig() {}
  static reset() {}
}

export const SandboxRuntimeConfigSchema = { parse: (x) => x };
export class SandboxViolationStore {
  static getViolations() { return []; }
  static clear() {}
}
`)

// @ant/claude-for-chrome-mcp — needs BROWSER_TOOLS and server exports
writeStub('@ant/claude-for-chrome-mcp', {
  name: '@ant/claude-for-chrome-mcp', version: '0.0.0-stub', type: 'module', main: 'index.mjs',
  exports: { '.': { import: './index.mjs', default: './index.mjs' } },
}, `
export const BROWSER_TOOLS = [];
export const createClaudeForChromeMcpServer = () => ({ listen: () => {} });
export const CHROME_MCP_SERVER_NAME = 'claude-in-chrome-stub';
export const getClaudeInChromeMcpServerConfig = () => ({});
export const isClaudeInChromeMcpTool = () => false;
`)

// @anthropic-ai/mcpb — needs getMcpConfigForManifest and types
writeStub('@anthropic-ai/mcpb', {
  name: '@anthropic-ai/mcpb', version: '0.0.0-stub', type: 'module', main: 'index.mjs',
  exports: { '.': { import: './index.mjs', default: './index.mjs' } },
}, `
export const getMcpConfigForManifest = async () => ({ tools: [] });
`)

// color-diff-napi — needs ColorDiff, ColorFile classes and getSyntaxTheme
writeStub('color-diff-napi', {
  name: 'color-diff-napi', version: '0.0.0-stub', type: 'module', main: 'index.mjs',
  exports: { '.': { import: './index.mjs', default: './index.mjs' } },
}, `
export class ColorDiff { constructor() {} diff() { return []; } }
export class ColorFile { constructor() {} }
export function getSyntaxTheme() { return {}; }
`)

// modifiers-napi — uses require(), needs CJS
const modDir = join(nodeModules, 'modifiers-napi')
if (!existsSync(join(modDir, 'package.json'))) {
  mkdirSync(modDir, { recursive: true })
  writeFileSync(join(modDir, 'package.json'), JSON.stringify({
    name: 'modifiers-napi', version: '0.0.0-stub', main: 'index.js',
  }))
  writeFileSync(join(modDir, 'index.js'),
    `module.exports = { prewarm: () => {}, isModifierPressed: () => false };\n`)
}
