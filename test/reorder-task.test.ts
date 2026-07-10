import { afterEach, describe, expect, it, vi } from "vitest";
import { PaulClient, configFromEnv } from "../src/client.js";
import { registerReorderTaskTool } from "../src/tools/reorder-task.js";
import {
  jsonResponse,
  mockFetchSequence,
  callInfo,
  captureToolHandler,
  TEST_ENV,
} from "./helpers.js";

const LOGIN_OK = { ok: true, user: { uid: "u1", name: "Diego", role: "dev" } };

function makeClient(): PaulClient {
  return new PaulClient(configFromEnv({ ...TEST_ENV }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("paul_reorder_task", () => {
  it("posts action=reorder_task with { id, to, reason } and passes the payload through", async () => {
    const mock = mockFetchSequence([
      jsonResponse(LOGIN_OK, { cookie: "IVCOACH=a" }),
      jsonResponse({ ok: true, moves_left: 3 }),
    ]);
    const handler = captureToolHandler(registerReorderTaskTool, makeClient());

    const res = await handler({ id: 480, to: 0, reason: "Close the finished integration task" });

    expect(res.isError).toBeUndefined();
    const payload = JSON.parse(res.content[0].text) as { ok: boolean; moves_left: number };
    expect(payload).toEqual({ ok: true, moves_left: 3 });
    const call = callInfo(mock, 1);
    expect(call.url).toContain("action=reorder_task");
    expect(call.body).toEqual({ id: 480, to: 0, reason: "Close the finished integration task" });
  });

  it("surfaces the 429 no_moves body verbatim as an error result", async () => {
    mockFetchSequence([
      jsonResponse(LOGIN_OK, { cookie: "IVCOACH=a" }),
      jsonResponse(
        { error: "no_moves", moves_left: 0, message: "Ya usaste tus 5 cambios de prioridad." },
        { status: 429 },
      ),
    ]);
    const handler = captureToolHandler(registerReorderTaskTool, makeClient());

    const res = await handler({ id: 480, to: 0, reason: "Close the finished integration task" });

    expect(res.isError).toBe(true);
    const payload = JSON.parse(res.content[0].text) as {
      error: boolean;
      status: number;
      api: { error: string; moves_left: number };
    };
    expect(payload.status).toBe(429);
    expect(payload.api.error).toBe("no_moves");
    expect(payload.api.moves_left).toBe(0);
  });
});
