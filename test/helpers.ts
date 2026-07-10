import { vi, type Mock } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolResult } from "../src/tools/shared.js";

/** Builds a JSON Response, optionally with a Set-Cookie header. */
export function jsonResponse(
  body: unknown,
  opts: { status?: number; cookie?: string } = {},
): Response {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
  if (opts.cookie) headers.append("set-cookie", opts.cookie);
  return new Response(JSON.stringify(body), { status: opts.status ?? 200, headers });
}

/**
 * Installs a global fetch mock that replays the given outcomes in order.
 * An Error entry makes that call reject (simulated transport failure).
 */
export function mockFetchSequence(responses: Array<Response | Error>): Mock {
  let i = 0;
  const mock = vi.fn(async () => {
    if (i >= responses.length) {
      throw new Error(`fetch called more times than expected (${responses.length})`);
    }
    const next = responses[i++];
    if (next instanceof Error) throw next;
    return next;
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

/** Extracts { url, method, headers, body } from a recorded fetch mock call. */
export function callInfo(mock: Mock, index: number): {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
} {
  const [url, init] = mock.mock.calls[index] as [string, RequestInit | undefined];
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries((init?.headers ?? {}) as Record<string, string>)) {
    headers[k.toLowerCase()] = v;
  }
  return {
    url: String(url),
    method: init?.method ?? "GET",
    headers,
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  };
}

/**
 * Minimal McpServer stand-in that captures the handler a register*Tool()
 * function installs, so tests can invoke the tool directly.
 */
export function captureToolHandler<C>(
  register: (server: McpServer, client: C) => void,
  client: C,
): (args: Record<string, unknown>) => Promise<ToolResult> {
  let handler: unknown;
  const server = {
    registerTool: (_name: string, _config: unknown, h: unknown) => {
      handler = h;
    },
  } as unknown as McpServer;
  register(server, client);
  if (handler === undefined) throw new Error("register did not install a tool handler");
  return handler as (args: Record<string, unknown>) => Promise<ToolResult>;
}

export const TEST_ENV = {
  PAUL_URL: "https://paul.example.com/iventas-coach",
  PAUL_EMAIL: "dev@example.com",
  PAUL_PASSWORD: "secret",
};
