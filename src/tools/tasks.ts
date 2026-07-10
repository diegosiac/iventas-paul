import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PaulClient } from "../client.js";
import { textResult, errorResult } from "./shared.js";

export function registerTasksTool(server: McpServer, client: PaulClient): void {
  server.registerTool(
    "paul_tasks",
    {
      title: "List PAUL tasks",
      description:
        "List the authenticated user's tasks (missions) in PAUL with a summary " +
        "of counts by status. Each task includes: id, title, status (pending | " +
        "active | waiting | confirm | done), priority (1=high), position in the " +
        "queue, estimated minutes, overdue info, requester, client, and week. " +
        "Call this FIRST to find the task id that matches the work performed, " +
        "before starting or closing anything. Note: PAUL only allows starting " +
        "the first pending task in queue order.",
      inputSchema: {},
    },
    async () => {
      try {
        const state = await client.state();
        const counts: Record<string, number> = {};
        for (const t of state.tasks) counts[t.status] = (counts[t.status] ?? 0) + 1;
        const tasks = state.tasks.map((t, i) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          position: i + 1,
          estMin: t.estMin,
          effMin: t.effMin,
          overdue: t.overdue,
          overdueMin: t.overdueMin,
          overdueLabel: t.overdueLabel,
          requester: t.requesterName,
          client: t.clientName,
          week: t.week,
          future: t.future,
        }));
        return textResult({
          user: state.user.name,
          week: state.week,
          summary: { total: tasks.length, byStatus: counts },
          priorityMovesLeft: state.moves_left,
          aiBudgetOk: state.budget?.ok ?? true,
          tasks,
        });
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
