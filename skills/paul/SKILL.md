---
name: paul
description: "Trigger: finish task, task done, register task, registrar tarea, checkpoint, PAUL. Register and close the user's tasks in PAUL via paul_* MCP tools."
license: Apache-2.0
metadata:
  author: diegosiac
  version: "1.0"
---

## Activation Contract

Activate when dev work in a work project reaches a done state (feature finished, bug fixed, PR merged) or the user asks to register/close a task in PAUL. Requires the paul_* MCP tools. Do nothing for personal projects unless asked.

## Hard Rules

- Checkpoint answers MUST come from this session's real work context: what was done, files touched, PRs, test/build outcomes. Never generic filler.
- If a checkpoint is rejected, add the ONE concrete detail PAUL requested to the weak answer and retry exactly once.
- Never invent a task id. Resolve it from `paul_tasks` first.
- Preserve PAUL's Spanish replies verbatim when reporting them.

## Decision Gates

- Matching task exists in `paul_tasks` → run the close flow.
- No matching task and the work is already done → `paul_register_task` (title + urgency), then run the close flow on the returned taskId.
- `paul_register_task` returns ok:false → show paulReply to the user; recover with `paul_chat` or a clearer title.
- Task blocked by queue order (`error: order`) → ask PAUL via `paul_chat` to prioritize it, then retry.

## Execution Steps

1. `paul_tasks` — locate the task matching the session's work.
2. `paul_start_task` with its id (skip if already active).
3. `paul_get_checkpoint` — fetch PAUL's 3 validation questions.
4. Draft answers from the session's real context; pair each with its exact question text.
5. `paul_submit_checkpoint` — submit; on rejection, improve per PAUL's feedback and retry once.

## Output Contract

Report to the user: task id and title, PAUL's verdict (approved or the requested improvement, verbatim), and any non-converged step with PAUL's actual reply. One short summary, no logs.
