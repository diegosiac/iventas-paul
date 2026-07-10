import { PaulApiError } from "../client.js";

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  [k: string]: unknown;
}

/** Wraps a JSON-serializable payload as an MCP text result. */
export function textResult(payload: unknown, isError = false): ToolResult {
  const result: ToolResult = {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
  if (isError) result.isError = true;
  return result;
}

/**
 * Converts an exception into an MCP error result. PaulApiError bodies are
 * passed through verbatim: the API returns actionable Spanish messages
 * (e.g. "order", "parallel_limit") the calling agent should read.
 */
export function errorResult(err: unknown): ToolResult {
  if (err instanceof PaulApiError) {
    return textResult({ error: true, status: err.status, api: err.body }, true);
  }
  const message = err instanceof Error ? err.message : String(err);
  return textResult({ error: true, message }, true);
}
