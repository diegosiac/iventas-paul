#!/usr/bin/env node
/**
 * paul-mcp — MCP server (stdio) exposing PAUL (iVentas COACH) task
 * management to AI coding agents.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PaulClient, configFromEnv } from "./client.js";
import { registerTasksTool } from "./tools/tasks.js";
import { registerStartTaskTool } from "./tools/start-task.js";
import { registerGetCheckpointTool } from "./tools/get-checkpoint.js";
import { registerSubmitCheckpointTool } from "./tools/submit-checkpoint.js";
import { registerRegisterTaskTool } from "./tools/register-task.js";
import { registerReorderTaskTool } from "./tools/reorder-task.js";
import { registerRedGateTool } from "./tools/red-gate.js";
import { registerChatTool } from "./tools/chat.js";
async function main() {
    // Fail fast on missing configuration, before accepting any MCP traffic.
    const client = new PaulClient(configFromEnv());
    const server = new McpServer({ name: "paul-mcp", version: "1.0.0" });
    registerTasksTool(server, client);
    registerStartTaskTool(server, client);
    registerGetCheckpointTool(server, client);
    registerSubmitCheckpointTool(server, client);
    registerRegisterTaskTool(server, client);
    registerReorderTaskTool(server, client);
    registerRedGateTool(server, client);
    registerChatTool(server, client);
    await server.connect(new StdioServerTransport());
}
main().catch((err) => {
    console.error(`paul-mcp failed to start: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
});
