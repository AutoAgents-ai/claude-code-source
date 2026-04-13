// ============================================================
// ToolRegistry — manages available tools for the agent loop
//
// LAYER: Core
//
// CONSTRAINTS:
// - Works with ExecutableTool interface (Host-agnostic)
// - No dependency on CLI-specific Tool type
// - Hosts register their tools here before starting the loop
// ============================================================

import type {
  ExecutableTool,
  ToolContext,
  ToolExecutionResult,
  ToolUse,
} from '@anthropic-ai/cc-types'

export class ToolRegistry {
  private tools = new Map<string, ExecutableTool>()

  register(tool: ExecutableTool): void {
    this.tools.set(tool.name, tool)
    if (tool.aliases) {
      for (const alias of tool.aliases) {
        this.tools.set(alias, tool)
      }
    }
  }

  unregister(name: string): void {
    const tool = this.tools.get(name)
    if (tool) {
      this.tools.delete(tool.name)
      if (tool.aliases) {
        for (const alias of tool.aliases) {
          this.tools.delete(alias)
        }
      }
    }
  }

  get(name: string): ExecutableTool | undefined {
    return this.tools.get(name)
  }

  getAll(): ExecutableTool[] {
    const seen = new Set<string>()
    const result: ExecutableTool[] = []
    for (const tool of this.tools.values()) {
      if (!seen.has(tool.name)) {
        seen.add(tool.name)
        if (tool.isEnabled()) {
          result.push(tool)
        }
      }
    }
    return result
  }

  async execute(
    toolUse: ToolUse,
    context: ToolContext,
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(toolUse.name)
    if (!tool) {
      return {
        content: `Tool not found: ${toolUse.name}`,
        isError: true,
      }
    }

    if (!tool.isEnabled()) {
      return {
        content: `Tool is not enabled: ${toolUse.name}`,
        isError: true,
      }
    }

    return tool.execute(toolUse.input, context)
  }

  isConcurrencySafe(name: string, input: Record<string, unknown>): boolean {
    const tool = this.tools.get(name)
    return tool?.isConcurrencySafe(input) ?? false
  }
}
