import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PaulClient } from "../client.js";
import { textResult, errorResult } from "./shared.js";

export function registerGetCheckpointTool(server: McpServer, client: PaulClient): void {
  server.registerTool(
    "paul_get_checkpoint",
    {
      title: "Get PAUL checkpoint questions",
      description:
        "Request PAUL's 3 AI validation questions for a task. THIS BEGINS THE " +
        "CLOSE FLOW: to mark a task done you must answer these questions via " +
        "paul_submit_checkpoint. Call it ONCE per close attempt: EVERY call " +
        "regenerates fresh questions and spends the company's AI budget — do " +
        "not call it again to 'refresh' or re-read questions you already have. " +
        "The questions are generated in Spanish and are " +
        "specific to the task. Keep the exact question texts — they must be sent " +
        "back verbatim with the answers. If 'ai' is false in the response, " +
        "PAUL's AI spend cap was reached and generic fallback questions were " +
        "used ('reason' explains why); they are still submittable and the flow " +
        "still works normally.",
      inputSchema: {
        id: z.number().int().positive().describe("Task id from paul_tasks"),
      },
    },
    async ({ id }) => {
      try {
        return textResult(await client.requestQuestions(id));
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
