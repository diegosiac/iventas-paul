# PAUL task tracking (copy into AGENTS.md)

```markdown
## PAUL task tracking

This project tracks work in PAUL (iVentas COACH) through the paul_* MCP tools.

- When you finish dev work here (feature done, bug fixed, PR merged), close the
  matching task in PAUL: `paul_tasks` to find it, `paul_start_task` if not
  active, `paul_get_checkpoint` for the 3 validation questions, then
  `paul_submit_checkpoint`.
- If no matching task exists and the work is already done, register it first
  with `paul_register_task` (title + urgency alta|media|baja), then run the
  close flow on the returned taskId.
- Checkpoint answers MUST describe the real work from this session: what was
  done, files touched, PRs, test/build outcomes. Never generic filler.
- If PAUL rejects a checkpoint, add the one concrete detail it asked for and
  retry once. Report PAUL's verdict to the user verbatim.
- If a flow does not converge (e.g. paul_register_task returns ok:false), show
  PAUL's reply to the user and recover via `paul_chat`.
```
