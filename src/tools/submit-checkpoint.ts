import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PaulClient } from "../client.js";
import { textResult, errorResult } from "./shared.js";

export function registerSubmitCheckpointTool(server: McpServer, client: PaulClient): void {
  server.registerTool(
    "paul_submit_checkpoint",
    {
      title: "Submit PAUL checkpoint answers",
      description:
        "Submit answers to PAUL's validation questions to close a task. " +
        "Write answers using the REAL context of the work performed in this " +
        "session (what was done, files, PRs, outcomes) — substantive, concrete " +
        "answers. Never generic filler. Pair each answer with the exact question " +
        "text returned by paul_get_checkpoint. Returns PAUL's verdict: " +
        "approved=true closes the task (or hands it off to the requester); " +
        "approved=false includes ONE concrete improvement PAUL wants — add that " +
        "specific detail to the weak answer and retry ONCE (the evaluator is " +
        "lenient from the 2nd attempt; 'attempt' in the response tracks this). " +
        "If 'ai' is false, the AI spend cap was reached and a non-AI fallback " +
        "evaluated the answers — substantive answers still pass.",
      inputSchema: {
        id: z.number().int().positive().describe("Task id from paul_tasks"),
        answers: z
          .array(
            z.object({
              question: z.string().describe("Exact question text from paul_get_checkpoint"),
              answer: z
                .string()
                .describe("Concrete answer grounded in this session's real work"),
            }),
          )
          .min(1)
          .describe("One entry per checkpoint question, in order"),
      },
    },
    async ({ id, answers }) => {
      try {
        const qa = answers.map((x) => ({ q: x.question, a: x.answer }));
        return textResult(await client.submitValidation(id, qa));
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
