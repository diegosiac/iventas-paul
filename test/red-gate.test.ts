import { afterEach, describe, expect, it, vi } from "vitest";
import { PaulClient, configFromEnv } from "../src/client.js";
import { registerRedGateTool } from "../src/tools/red-gate.js";
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

describe("paul_resolve_red_gate", () => {
  it("rejects a plan under 50 chars WITHOUT calling the API", async () => {
    // An empty fetch sequence: any network call would throw.
    const mock = mockFetchSequence([]);
    const handler = captureToolHandler(registerRedGateTool, makeClient());

    const res = await handler({ flagId: 12, plan: "  I will be more careful.  " });

    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/50/);
    expect(mock).not.toHaveBeenCalled();
  });

  it("accepts a plan of exactly 50 trimmed chars (server boundary)", async () => {
    // 50 chars exactly — mirrors the server's trim-then-check-≥50 rule.
    const plan = "Registrar la tarea al iniciar y cerrar al terminar";
    expect(plan.trim().length).toBe(50);
    const mock = mockFetchSequence([
      jsonResponse(LOGIN_OK, { cookie: "IVCOACH=a" }),
      jsonResponse({ ok: true, approved: true, message: "Gracias." }),
    ]);
    const handler = captureToolHandler(registerRedGateTool, makeClient());

    const res = await handler({ flagId: 12, plan });

    expect(res.isError).toBeUndefined();
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("rejects a 49-char plan even when whitespace padding makes it look longer", async () => {
    const plan = "   Registrar la tarea al iniciar y cerrar al termina   ";
    expect(plan.trim().length).toBe(49);
    expect(plan.length).toBeGreaterThanOrEqual(50);
    const mock = mockFetchSequence([]);
    const handler = captureToolHandler(registerRedGateTool, makeClient());

    const res = await handler({ flagId: 12, plan });

    expect(res.isError).toBe(true);
    expect(mock).not.toHaveBeenCalled();
  });

  it("sends a valid plan and passes through approved:false", async () => {
    const plan =
      "Registrar e iniciar la tarea en PAUL al comenzar el trabajo real y cerrarla al terminar.";
    const mock = mockFetchSequence([
      jsonResponse(LOGIN_OK, { cookie: "IVCOACH=a" }),
      jsonResponse({ ok: true, approved: false, message: "Sé más concreto." }),
    ]);
    const handler = captureToolHandler(registerRedGateTool, makeClient());

    const res = await handler({ flagId: 12, plan });

    expect(res.isError).toBeUndefined();
    const payload = JSON.parse(res.content[0].text) as {
      ok: boolean;
      approved: boolean;
      message: string;
    };
    expect(payload.ok).toBe(true);
    expect(payload.approved).toBe(false);
    expect(payload.message).toMatch(/concreto/);
    const call = callInfo(mock, 1);
    expect(call.url).toContain("action=red_gate_ack");
    expect(call.body).toMatchObject({ flag_id: 12, plan });
  });
});
