# iventas-paul

MCP server (stdio) that lets AI coding agents — Claude Code, Codex, OpenCode —
register and close the user's tasks in **PAUL** (the iVentas COACH task
manager). After finishing dev work, the agent finds the matching task, starts
it, requests PAUL's 3 AI validation questions, and answers them with the real
context of the session's work. There is no direct create-task API in PAUL, so
new tasks are registered through PAUL's coach chat dialogue with defensive
verification against the task list.

## Tools

| Tool | Purpose |
| --- | --- |
| `paul_tasks` | List the user's tasks with a summary of counts by status |
| `paul_start_task` | Start (or resume) a task by id |
| `paul_get_checkpoint` | Get PAUL's 3 validation questions (begins the close flow) |
| `paul_submit_checkpoint` | Submit answers; returns PAUL's verdict |
| `paul_register_task` | Register a new task via the chat dialogue, verified against state |
| `paul_chat` | Free-form message to PAUL (reorder, pause, ask anything) |

## Configuration

Three environment variables (the server fails fast if any is missing):

- `PAUL_URL` — base URL up to the app folder, e.g. `https://example.com/iventas-coach`
- `PAUL_EMAIL` — the collaborator's login email
- `PAUL_PASSWORD` — the collaborator's password

The session cookie is kept in memory only; nothing is written to disk.

## Per-agent setup

All examples run the server straight from GitHub with
`npx -y github:diegosiac/iventas-paul`. Prefer
**project-scoped** config in your work repos: it keeps personal projects clean —
agents only see the PAUL tools where they are relevant.

### Claude Code — project `.mcp.json`

```json
{
  "mcpServers": {
    "paul": {
      "command": "npx",
      "args": ["-y", "github:diegosiac/iventas-paul"],
      "env": {
        "PAUL_URL": "https://example.com/iventas-coach",
        "PAUL_EMAIL": "you@company.com",
        "PAUL_PASSWORD": "your-password"
      }
    }
  }
}
```

### Codex — `~/.codex/config.toml`

```toml
[mcp_servers.paul]
command = "npx"
args = ["-y", "github:diegosiac/iventas-paul"]

[mcp_servers.paul.env]
PAUL_URL = "https://example.com/iventas-coach"
PAUL_EMAIL = "you@company.com"
PAUL_PASSWORD = "your-password"
```

### OpenCode — project `opencode.json`

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "paul": {
      "type": "local",
      "command": ["npx", "-y", "github:diegosiac/iventas-paul"],
      "environment": {
        "PAUL_URL": "https://example.com/iventas-coach",
        "PAUL_EMAIL": "you@company.com",
        "PAUL_PASSWORD": "your-password"
      }
    }
  }
}
```

## Installing the skill into a work repo

The skill teaches Claude Code *when* to use the tools (register/close tasks
after finishing dev work, answer checkpoints from real session context):

```sh
mkdir -p .claude/skills/paul
cp node_modules/iventas-paul/skills/paul/SKILL.md .claude/skills/paul/
# or copy skills/paul/SKILL.md from a checkout of this repo
```

For Codex/OpenCode, paste the block from `AGENTS-snippet.md` into the repo's
`AGENTS.md`.

## Development

```sh
npm install    # also builds via the prepare script
npm test       # vitest unit tests (fetch is mocked; never hits a live server)
npm run build  # tsc -> dist/
```

## Security note

Credentials live only in your local agent configuration env blocks. Never
commit them: keep `.mcp.json` / `opencode.json` entries with real credentials
out of version control (or inject the env vars from your shell). This server
never persists the session cookie or credentials to disk.
