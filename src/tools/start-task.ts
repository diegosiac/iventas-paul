import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PaulClient } from "../client.js";
import { textResult, errorResult } from "./shared.js";

export function registerStartTaskTool(server: McpServer, client: PaulClient): void {
  server.registerTool(
    "paul_start_task",
    {
      title: "Start a PAUL task",
      description:
        "Start (activate) a mission by task id. A task must be started before " +
        "it can be closed through the checkpoint flow. Constraints enforced by " +
        "PAUL: at most 2 tasks active in parallel, and only the FIRST pending " +
        "task in queue order can be started (error 'order' otherwise — use " +
        "paul_chat to ask PAUL to reprioritize, then retry). Starting a task " +
        "in 'waiting' status resumes it. If the task is already active this " +
        "succeeds as a no-op.",
      inputSchema: {
        id: z.number().int().positive().describe("Task id from paul_tasks"),
      },
    },
    async ({ id }) => {
      try {
        return textResult(await client.startTask(id));
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
