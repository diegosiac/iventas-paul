import { z } from "zod";
import { textResult, errorResult } from "./shared.js";
/** Server-side minimum plan length enforced by red_gate_ack (api.php:927-944). */
const MIN_PLAN_LENGTH = 50;
export function registerRedGateTool(server, client) {
    server.registerTool("paul_resolve_red_gate", {
        title: "Resolve a PAUL red gate (team-visible time flag)",
        description: "Resolve a red gate — the team-visible time-hygiene flag PAUL raises " +
            "when a task ran under 2 effective minutes (too_fast) or started more " +
            "than 4 business-hours after the previous task finished (slow_start). " +
            "Call this IMMEDIATELY when paul_submit_checkpoint's verdict includes " +
            "a red_gate object (use its flag_id). The flag blocks nothing, but it " +
            "reappears in every state until resolved and the weekly red-flag count " +
            "is visible to the WHOLE team. Write an HONEST, concrete plan of at " +
            "least 50 characters answering how this won't happen again — the " +
            "canonical honest plan: register and START the PAUL task when " +
            "beginning the real work, and close it when the work ends. PAUL's AI " +
            "evaluates the plan's seriousness: approved:false means write a more " +
            "concrete plan and retry.",
        inputSchema: {
            flagId: z
                .number()
                .int()
                .positive()
                .describe("flag_id from the red_gate object in the checkpoint verdict"),
            plan: z
                .string()
                .describe("Honest, concrete prevention plan (at least 50 characters)"),
        },
    }, async ({ flagId, plan }) => {
        // Client-side guard: the server rejects plans under 50 chars, so save
        // the round-trip and tell the agent exactly what to fix.
        if (plan.trim().length < MIN_PLAN_LENGTH) {
            return textResult({
                error: true,
                message: `Plan too short (${plan.trim().length} chars): PAUL requires a plan of at ` +
                    `least ${MIN_PLAN_LENGTH} characters. Write an honest, concrete plan — e.g. ` +
                    "register and START the PAUL task when beginning the real work, and close " +
                    "it when the work ends. No API call was made.",
            }, true);
        }
        try {
            return textResult(await client.redGateAck(flagId, plan));
        }
        catch (err) {
            return errorResult(err);
        }
    });
}
