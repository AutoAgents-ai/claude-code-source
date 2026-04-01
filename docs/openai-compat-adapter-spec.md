# OpenAI-Compatible Adapter 参考规格

> 基于 One API (songquanpeng/one-api) 和 New API (Calcium-Ion/new-api) 的协议翻译逻辑提取。
> 我们的方向：Claude Code 内部发出 Anthropic Messages 格式 → 适配器翻译成 OpenAI Chat Completions → 发给 Kimi/GLM/Qwen。
> 响应方向：OpenAI Chat Completions 响应 → 适配器翻译回 Anthropic Messages 格式 → 返回给 Claude Code 内部。

## 1. 请求转换：Anthropic Messages → OpenAI Chat Completions

### 1.1 System Prompt
- Anthropic: 顶层 `system` 字段（字符串或 content block 数组）
- OpenAI: `messages[0]` 插入 `{ role: "system", content: systemText }`
- 多段 system block → 拼接成一个字符串

### 1.2 Messages
- Anthropic `role: "user"` / `role: "assistant"` → OpenAI 对应 role
- Content blocks 转换：

| Anthropic content block | OpenAI message format |
|---|---|
| `{ type: "text", text: "..." }` | `content: "..."` 或 `{ type: "text", text: "..." }` |
| `{ type: "image", source: { type: "base64", media_type, data } }` | `{ type: "image_url", image_url: { url: "data:{media_type};base64,{data}" } }` |
| `{ type: "tool_use", id, name, input }` | assistant message 上的 `tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(input) } }]` |
| `{ type: "tool_result", tool_use_id, content }` | `{ role: "tool", tool_call_id: tool_use_id, content: stringContent }` |
| `{ type: "thinking", thinking }` | 多数国产模型支持：DeepSeek/Qwen/Kimi/GLM 均有 `reasoning_content`，适配器做双向映射 |

### 1.3 Tools Schema
- Anthropic: `tools[].input_schema` (JSON Schema with type/properties/required)
- OpenAI: `tools[].function.parameters` (同样的 JSON Schema)
- 映射：`{ type: "function", function: { name, description, parameters: input_schema } }`

### 1.4 Tool Choice
| Anthropic | OpenAI |
|---|---|
| `{ type: "auto" }` | `"auto"` |
| `{ type: "any" }` | `"required"` |
| `{ type: "none" }` 或不传 | `"none"` |
| `{ type: "tool", name: "xxx" }` | `{ type: "function", function: { name: "xxx" } }` |

### 1.5 其他参数
| Anthropic param | OpenAI param | 说明 |
|---|---|---|
| `model` | `model` | 从 Registry 读取目标模型名 |
| `max_tokens` | `max_tokens` | 直接传递 |
| `temperature` | `temperature` | 直接传递 |
| `top_p` | `top_p` | 直接传递 |
| `stream: true` | `stream: true` | 直接传递 |
| `stop_sequences` | `stop` | 直接传递 |

### 1.6 Thinking / Reasoning 映射

国产模型普遍支持 thinking/reasoning 能力，适配器需要做**双向映射**：

**请求方向（Anthropic → OpenAI）**：
- Anthropic `thinking: { type: "enabled", budget_tokens: N }` → 对应模型的 thinking 开关
  - Qwen: `enable_thinking: true`
  - DeepSeek: 使用 `deepseek-reasoner` 模型名自动启用
  - GLM: 使用 `glm-4-thinking` 模型名
  - Kimi: k1.5 模型自动启用

**响应方向（OpenAI → Anthropic）**：
- OpenAI `reasoning_content` → Anthropic `{ type: "thinking", thinking: "..." }` content block
- 流式：`delta.reasoning_content` → `thinking_delta` 事件（参考 New API 实现）

### 1.7 Prompt Caching 处理

Anthropic 使用客户端 `cache_control` 标记；国产模型多为**服务端自动缓存**（前缀匹配）。

- 适配器在转换时**剥离 `cache_control` 字段**（OpenAI 格式不认）
- 服务端自动缓存仍然生效（对话前缀不变即命中）
- 响应中的 `cache_creation_input_tokens` / `cache_read_input_tokens` 不返回（上层代码已处理缺失情况）

### 1.8 忽略的 Anthropic 特有参数
- `betas` — Anthropic beta 标记，OpenAI 无对应
- `metadata` — Anthropic 元数据
- `context_management` — Anthropic 特有
- `output_config.effort` — Anthropic 特有（但可映射到部分模型的 reasoning effort）

## 2. 响应转换：OpenAI Chat Completions → Anthropic Messages

### 2.1 非流式响应

OpenAI `ChatCompletion` → Anthropic `BetaMessage`:

```
{
  id: "msg_" + openaiResponse.id,
  type: "message",
  role: "assistant",
  model: openaiResponse.model,
  content: [...],  // 见下方转换
  stop_reason: finishReasonToStopReason(choice.finish_reason),
  usage: {
    input_tokens: usage.prompt_tokens,
    output_tokens: usage.completion_tokens,
  }
}
```

Content 转换：
- `choice.message.content` (string) → `[{ type: "text", text: content }]`
- `choice.message.tool_calls` → 每个转成 `{ type: "tool_use", id, name, input: JSON.parse(arguments) }`
- 两者都有时，text 在前，tool_use 在后

### 2.2 finish_reason → stop_reason 映射

| OpenAI finish_reason | Anthropic stop_reason |
|---|---|
| `"stop"` | `"end_turn"` |
| `"length"` | `"max_tokens"` |
| `"tool_calls"` | `"tool_use"` |
| `"content_filter"` | `"end_turn"` (降级) |
| `null` | `null` |

### 2.3 流式响应 (SSE)

这是最复杂的部分。需要把 OpenAI 的 stream chunks 翻译成 Anthropic 的事件序列。

**OpenAI stream chunk 格式**:
```
data: {"id":"chatcmpl-xxx","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}
```

**Anthropic 事件序列**（需要组装）:

1. **首包** → `message_start` 事件
```json
{ "type": "message_start", "message": { "id": "msg_xxx", "type": "message", "role": "assistant", "model": "...", "content": [], "usage": { "input_tokens": 0, "output_tokens": 0 } } }
```

2. **文本开始** → `content_block_start`
```json
{ "type": "content_block_start", "index": 0, "content_block": { "type": "text", "text": "" } }
```

3. **文本增量** → `content_block_delta`
```json
{ "type": "content_block_delta", "index": 0, "delta": { "type": "text_delta", "text": "Hello" } }
```

4. **文本结束** → `content_block_stop`
```json
{ "type": "content_block_stop", "index": 0 }
```

5. **工具调用开始** → `content_block_start`
```json
{ "type": "content_block_start", "index": 1, "content_block": { "type": "tool_use", "id": "call_xxx", "name": "read_file", "input": {} } }
```

6. **工具参数增量** → `content_block_delta`
```json
{ "type": "content_block_delta", "index": 1, "delta": { "type": "input_json_delta", "partial_json": "{\"path\":" } }
```

7. **工具调用结束** → `content_block_stop`
```json
{ "type": "content_block_stop", "index": 1 }
```

8. **消息结束** → `message_delta` + `message_stop`
```json
{ "type": "message_delta", "delta": { "stop_reason": "end_turn" }, "usage": { "output_tokens": 42 } }
{ "type": "message_stop" }
```

**流式状态机**（参考 New API 的 ClaudeConvertInfo）:

需要跟踪：
- `contentBlockIndex`: 当前 content block 索引（text=0, tool_use=1, 2, ...）
- `currentBlockType`: 当前块类型 ('text' | 'tool_use' | null)
- `isFirstChunk`: 是否为第一个 chunk（触发 message_start）
- `toolCallBaseIndex`: 工具调用的 base index
- `accumulatedToolArgs`: 已累积的工具参数 JSON 片段

**关键边界情况**（One API / New API 踩过的坑）:
- 工具参数为空时，强制输出 `"{}"`（否则 JSON parse 失败）
- 同一条消息里既有 text 又有 tool_calls 时，需要先发完 text block 再发 tool_use block
- `content_block_stop` 必须在类型切换时发出
- OpenAI 的 `tool_calls[].index` 用于并行工具调用，需要映射到 content block index

## 3. countTokens 处理

Anthropic 的 `beta.messages.countTokens` 在 OpenAI 兼容模式下无对应 API。
- 方案 A：使用 tiktoken 本地估算（精度低但无网络请求）
- 方案 B：返回基于字符数的粗估（4 chars ≈ 1 token）
- 方案 C：跳过 token 计数，返回 0（影响上下文管理精度）

建议：方案 B 作为默认，后续可按模型实际 tokenizer 优化。

## 4. 模型特殊处理

### Kimi (Moonshot)
- Base URL: `https://api.moonshot.cn/v1`
- 标准 OpenAI 格式，无特殊处理
- Tool calling 支持良好

### GLM (智谱)
- Base URL: `https://open.bigmodel.cn/api/paas/v4`
- 标准 OpenAI 格式
- 注意：GLM 的 tool_calls 参数可能不是严格 JSON（需要容错 parse）

### Qwen (通义)
- Base URL: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- 标准 OpenAI 格式
- DashScope 也有原生 Anthropic 兼容路由（`/apps/anthropic/v1/messages`），但走 OpenAI 兼容更通用

## 5. 参考源码位置

### One API
- 核心翻译: `relay/adaptor/anthropic/main.go` (~300 行)
- 数据结构: `relay/adaptor/anthropic/model.go`
- 停止原因映射: `main.go:stopReasonClaude2OpenAI`

### New API
- Claude→OpenAI 请求: `service/convert.go:ClaudeToOpenAIRequest`
- OpenAI→Claude 响应: `service/convert.go:ResponseOpenAI2Claude`/`StreamResponseOpenAI2Claude`
- Claude→OpenAI 响应: `relay/channel/claude/relay-claude.go:ResponseClaude2OpenAI`
- 停止原因映射: `relay/reasonmap/reasonmap.go`
- 流式状态机: `relay/common/relay_info.go:ClaudeConvertInfo`
