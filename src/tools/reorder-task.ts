import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PaulClient } from "../client.js";
import { textResult, errorResult } from "./shared.js";

export function registerReorderTaskTool(server: McpServer, client: PaulClient): void {
  server.registerTool(
    "paul_reorder_task",
    {
      title: "Reorder a PAUL task (spends a weekly move)",
      description:
        "Move a PENDING task to another position in the user's open list " +
        "(pending + active + waiting, in queue order). Use this when " +
        "paul_start_task fails with error 'order': to=0 moves the task to the " +
        "TOP of the list so it becomes the first pending and can be started. " +
        "Only tasks in 'pending' status can move (409 bad_status otherwise), " +
        "and a reason is required. IMPORTANT: every effective move SPENDS 1 of " +
        "the user's 5 weekly priority moves — spend them consciously. When the " +
        "budget is exhausted the API answers 429 { error: 'no_moves' } and the " +
        "only options left are finishing the current first pending task or " +
        "asking an admin; moves reset on Monday. Returns { ok, moves_left } " +
        "(plus noop:true when the task was already at the target position, " +
        "which spends nothing).",
      inputSchema: {
        id: z.number().int().positive().describe("Task id from paul_tasks"),
        to: z
          .number()
          .int()
          .min(0)
          .describe("0-based target index in the open list; use 0 to move the task to the top"),
        reason: z
          .string()
          .min(5)
          .describe("Why the task must move now (required by PAUL, visible to the team)"),
      },
    },
    async ({ id, to, reason }) => {
      try {
        return textResult(await client.reorderTask(id, to, reason));
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
