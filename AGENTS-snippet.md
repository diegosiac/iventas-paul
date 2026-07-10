# PAUL task tracking (copy into AGENTS.md)

```markdown
## PAUL task tracking

This project tracks work in PAUL (iVentas COACH) through the paul_* MCP tools.

- When you BEGIN dev work here, register and START the matching task in PAUL
  right away: `paul_tasks` to find it (or `paul_register_task` with title +
  urgency alta|media|baja to create it), then `paul_start_task`. PAUL's
  Start/Finish timestamps must reflect the real work — closing right after
  registering always raises a team-visible too_fast red flag.
- When the work is DONE, close the task: `paul_get_checkpoint` for the 3
  validation questions (call it once; every call spends AI budget), then
  `paul_submit_checkpoint`. Only close tasks you actually started and worked
  on.
- If the verdict includes a red_gate, resolve it immediately with
  `paul_resolve_red_gate` and an honest plan (start the PAUL task when the
  real work begins, close it when it ends).
- If `paul_start_task` fails with error 'order', use `paul_reorder_task` with
  to=0 — it costs 1 of 5 weekly priority moves, spend them consciously. With
  'parallel_limit': max 2 tasks active, and the clock splits while 2 run.
- Task titles and `paul_chat` free text must NEVER include urgency words
  (alta/media/baja/urgente/normal/regular/low...) except when answering the
  urgency question — they would commit a stale server-side pending
  assignment. This includes ABM phrasing: rephrase "Dar de alta X" as
  "Habilitar X" and "Dar de baja X" as "Desactivar X". Also avoid asking the coach to "start the next task": it can
  silently reorder the list and deactivate the active task.
- Tasks assigned by someone else end in status 'confirm' after approval (the
  requester must ack) — expected, don't retry.
- Don't poll `paul_tasks` in a loop: the state endpoint has server-side side
  effects (coach messages, nudges).
- Checkpoint answers MUST describe the real work from this session: what was
  done, files touched, PRs, test/build outcomes. Never generic filler.
- If PAUL rejects a checkpoint, add the one concrete detail it asked for and
  retry once. Report PAUL's verdict to the user verbatim.
- If a flow does not converge (e.g. paul_register_task returns ok:false), show
  PAUL's reply to the user and recover via `paul_chat`.
```
