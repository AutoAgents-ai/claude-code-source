# Claude Code

![](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=flat-square) [![npm]](https://www.npmjs.com/package/@anthropic-ai/claude-code)

[npm]: https://img.shields.io/npm/v/@anthropic-ai/claude-code.svg?style=flat-square

Claude Code is an agentic coding tool that lives in your terminal, understands your codebase, and helps you code faster by executing routine tasks, explaining complex code, and handling git workflows -- all through natural language commands. Use it in your terminal, IDE, or tag @claude on Github.

**Learn more at [Claude Code Homepage](https://claude.com/product/claude-code)** | [Documentation](https://code.claude.com/docs/en/overview)

<img src="https://github.com/anthropics/claude-code/blob/main/demo.gif?raw=1" />

## Get started

1. Install Claude Code:

```sh
npm install -g @anthropic-ai/claude-code
```

2. Navigate to your project directory and run `claude`.

## Private Deployment Environment Variables (AutoAgents)

If you are running this fork in private mode with an OpenAI-compatible backend
(for example Kimi/GLM/Qwen), configure environment variables before launching
`autoagents`.

### 1) Create a `.env` file

```bash
# --- Deployment profile ---
CLAUDE_DEPLOYMENT_PROFILE=private

# --- Optional: disable nonessential network traffic ---
CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
DISABLE_TELEMETRY=1

# --- OpenAI-compatible endpoint ---
OPENAI_COMPAT_BASE_URL=https://api.moonshot.cn/v1
OPENAI_COMPAT_API_KEY=your_api_key_here
OPENAI_COMPAT_MODEL=kimi-k2.5

# --- Display model in UI (should match OPENAI_COMPAT_MODEL) ---
ANTHROPIC_MODEL=kimi-k2.5
```

### 2) Export env vars and run

```bash
set -a
source .env
set +a

autoagents
```

## Build a Local Binary

You can build a standalone executable with Bun compile:

```bash
mkdir -p dist
VERSION="${VERSION:-$(node -p "require('./package.json').version")}"
BUILD_TIME="${BUILD_TIME:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"

bun build src/entrypoints/cli.tsx \
  --compile \
  --target bun-darwin-arm64 \
  --outfile dist/autoagents \
  --tsconfig-override tsconfig.json \
  --define "MACRO.VERSION='${VERSION}'" \
  --define "MACRO.PACKAGE_URL='@anthropic-ai/claude-code'" \
  --define "MACRO.NATIVE_PACKAGE_URL=undefined" \
  --define "MACRO.BUILD_TIME='${BUILD_TIME}'" \
  --define "MACRO.VERSION_CHANGELOG=''" \
  --define "MACRO.FEEDBACK_CHANNEL='https://github.com/anthropics/claude-code/issues'" \
  --define "MACRO.ISSUES_EXPLAINER='report issues at https://github.com/anthropics/claude-code/issues'" \
  --define "process.env.USER_TYPE='external'"
```

Output binary:

- `dist/autoagents` (macOS Apple Silicon target shown above)

## Reporting Bugs

We welcome your feedback. Use the `/bug` command to report issues directly within Claude Code, or file a [GitHub issue](https://github.com/anthropics/claude-code/issues).

## Connect on Discord

Join the [Claude Developers Discord](https://anthropic.com/discord) to connect with other developers using Claude Code. Get help, share feedback, and discuss your projects with the community.

## Data collection, usage, and retention

When you use Claude Code, we collect feedback, which includes usage data (such as code acceptance or rejections), associated conversation data, and user feedback submitted via the `/bug` command.

### How we use your data

See our [data usage policies](https://code.claude.com/docs/en/data-usage).

### Privacy safeguards

We have implemented several safeguards to protect your data, including limited retention periods for sensitive information and restricted access to user session data.

For full details, please review our [Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms) and [Privacy Policy](https://www.anthropic.com/legal/privacy).
