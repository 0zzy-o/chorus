# Chorus

Coordinate multiple AI models through iterative debate. Chorus orchestrates AI CLI tools (Claude Code, Codex CLI) or their APIs, making them critique each other's outputs in rounds until they converge on a refined result.

## How it works

1. You describe a task
2. Multiple AI models independently generate plans (in parallel)
3. Each model receives the other's output, critiques it, and produces an improved version
4. This repeats until the outputs converge (or max rounds is reached)
5. You review a side-by-side comparison, then approve, reject, or edit the final plan
6. Optionally execute the approved plan via a provider

## Install

```bash
npm install
```

## Usage

```bash
# Run with tsx (development)
npx tsx src/index.ts "add a login page to this app"

# Build and run compiled
npm run build
chorus "add a login page to this app"
```

### Options

```
-r, --rounds <n>        Maximum debate rounds (default: 3)
-p, --providers <list>  Comma-separated provider names (default: claude,codex)
-m, --mode <mode>       Provider mode: "cli" or "api"
-e, --execute           Execute the plan after approval
-v, --verbose           Show raw model output
-c, --config <path>     Path to config file
-t, --threshold <n>     Convergence threshold 0-1 (default: 0.85)
-d, --dir <path>        Working directory for providers (default: cwd)
```

### Examples

```bash
# Use both providers in CLI mode (default)
chorus "add authentication to the API"

# API mode (no CLIs needed, uses API keys)
chorus --mode api "refactor the database layer"

# Single provider
chorus --providers claude "add a login page"

# More debate rounds with verbose output
chorus --rounds 5 --verbose "migrate from REST to GraphQL"

# Execute the plan after approval
chorus --execute "add input validation to all endpoints"

# Run against a different project directory
chorus --dir /path/to/project "add a login page"
```

## Providers

Each provider supports two modes:

| Provider | CLI mode | API mode |
|----------|----------|----------|
| `claude` | Spawns `claude` CLI | Calls Anthropic Messages API |
| `codex`  | Spawns `codex` CLI  | Calls OpenAI Chat Completions API |

### CLI mode (default)

Requires the respective CLI tools installed and authenticated:
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- [Codex CLI](https://github.com/openai/codex)

### API mode

Requires API keys set as environment variables:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
```

Or set `apiKey` in the config file.

## Configuration

Create a `.chorus.config.json` in your project root:

```json
{
  "providers": ["claude", "codex"],
  "maxRounds": 3,
  "convergenceThreshold": 0.85,
  "timeoutMs": 120000,
  "providerConfig": {
    "claude": {
      "mode": "api",
      "model": "claude-sonnet-4-6"
    },
    "codex": {
      "mode": "cli"
    }
  }
}
```

You can mix modes — e.g. one provider via CLI and another via API.

## Convergence

Plans are compared using Jaccard similarity on tokenized step titles. When the average pairwise similarity across all providers meets the threshold (default 85%), the debate stops. This keeps things simple with no external dependencies.
