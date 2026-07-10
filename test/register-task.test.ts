import { afterEach, describe, expect, it, vi } from "vitest";
import { PaulClient, configFromEnv } from "../src/client.js";
import { registerTask } from "../src/tools/register-task.js";
import { jsonResponse, mockFetchSequence, callInfo, TEST_ENV } from "./helpers.js";

const LOGIN_OK = { ok: true, user: { uid: "u1", name: "Diego", role: "dev" } };

function stateWith(tasks: Array<Record<string, unknown>>) {
  return {
    user: { name: "Diego", role: "dev" },
    tasks,
    week: { start: "2026-07-06", end: "2026-07-12" },
    budget: { ok: true },
    moves_left: 3,
  };
}

const OLD_TASK = { id: 1, title: "Old mission", status: "active", priority: 2, estMin: 60 };

const URGENCY_QUESTION = {
  reply:
    'Antes de agregar "Fix login form bug" a tu lista, dime la urgencia: ¿**alta**, **media** o **baja**?',
  ai: true,
  learned: false,
  mood: "curiosidad",
  assigned: false,
  assign_preview: null,
  assign_multi: null,
  undo_id: null,
};

function makeClient(): PaulClient {
  return new PaulClient(configFromEnv({ ...TEST_ENV }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("registerTask", () => {
  it("converges through the urgency dialogue and confirms the task via state", async () => {
    const mock = mockFetchSequence([
      jsonResponse(LOGIN_OK, { cookie: "IVCOACH=a" }),
      jsonResponse(stateWith([OLD_TASK])), // state before
      jsonResponse(URGENCY_QUESTION), // chat 1: PAUL asks urgency
      jsonResponse({
        reply: 'Listo, urgencia media. 📌 "Fix login form bug" quedó en tu lista.',
        ai: true,
        learned: false,
        assigned: true,
      }), // chat 2: urgency answered
      jsonResponse(
        stateWith([
          OLD_TASK,
          { id: 42, title: "Fix login form bug", status: "pending", priority: 2, estMin: 60 },
        ]),
      ), // state after
    ]);

    const result = await registerTask(makeClient(), "Fix login form bug", "media");

    expect(result.ok).toBe(true);
    expect(result.taskId).toBe(42);
    expect(mock).toHaveBeenCalledTimes(5);

    const chat1 = callInfo(mock, 2);
    expect(chat1.url).toContain("action=coach_chat");
    expect((chat1.body as { message: string }).message).toContain("Fix login form bug");

    const chat2 = callInfo(mock, 3);
    expect(chat2.url).toContain("action=coach_chat");
    expect((chat2.body as { message: string }).message).toBe("media");
  });

  it("accepts a direct commit (no urgency question) and matches the rewritten title", async () => {
    const mock = mockFetchSequence([
      jsonResponse(LOGIN_OK, { cookie: "IVCOACH=a" }),
      jsonResponse(stateWith([OLD_TASK])), // state before
      jsonResponse({
        reply: '📌 Listo, agregué la tarea a tu lista.',
        ai: true,
        learned: false,
        assigned: true,
        undo_id: 43,
      }), // chat 1: PAUL committed directly
      jsonResponse(
        stateWith([
          OLD_TASK,
          // PAUL's AI rewrote the title, but it still shares enough keywords
          { id: 43, title: "Corregir el form bug", status: "pending", priority: 1, estMin: 60 },
        ]),
      ), // state after
    ]);

    const result = await registerTask(makeClient(), "fix form bug", "alta");

    expect(result.ok).toBe(true);
    expect(result.taskId).toBe(43);
    // no second chat message was sent
    expect(mock).toHaveBeenCalledTimes(4);
  });

  it("returns ok:false with PAUL's reply when the dialogue does not converge", async () => {
    mockFetchSequence([
      jsonResponse(LOGIN_OK, { cookie: "IVCOACH=a" }),
      jsonResponse(stateWith([OLD_TASK])), // state before
      jsonResponse({
        reply:
          "¿Quieres dar de alta una tarea nueva o reordenar las que ya tienes (subir la siguiente y bajar la actual)?",
        ai: true,
        learned: false,
        assigned: false,
      }), // chat 1: unexpected clarification
      jsonResponse(stateWith([OLD_TASK])), // state after: nothing new
    ]);

    const result = await registerTask(makeClient(), "Fix login form bug", "media");

    expect(result.ok).toBe(false);
    expect(result.paulReply).toMatch(/dar de alta una tarea nueva o reordenar/);
    expect(result.taskId).toBeUndefined();
  });

  it("returns ok:false when PAUL claims success but state shows no new task", async () => {
    mockFetchSequence([
      jsonResponse(LOGIN_OK, { cookie: "IVCOACH=a" }),
      jsonResponse(stateWith([OLD_TASK])), // state before
      jsonResponse(URGENCY_QUESTION), // chat 1
      jsonResponse({
        reply: "Listo, urgencia media.",
        ai: true,
        learned: false,
        assigned: true,
      }), // chat 2
      jsonResponse(stateWith([OLD_TASK])), // state after: task never appeared
    ]);

    const result = await registerTask(makeClient(), "Fix login form bug", "media");

    expect(result.ok).toBe(false);
    expect(result.paulReply).toBe("Listo, urgencia media.");
  });

  it("accepts a heavily paraphrased commit as titleMismatch when the reply carried an undo_id", async () => {
    // undo_id is set ONLY by the legitimate self-assign commit path in
    // api.php (commit_assignment): its presence proves PAUL processed OUR
    // message and created OUR task, even when the AI rewrote the title
    // beyond the fuzzy-match threshold. It must NEVER be auto-undone.
    const mock = mockFetchSequence([
      jsonResponse(LOGIN_OK, { cookie: "IVCOACH=a" }),
      jsonResponse(stateWith([OLD_TASK])), // state before
      jsonResponse({
        reply: '📌 "Publicar el nuevo portal de documentación" quedó en tu lista.',
        ai: true,
        learned: false,
        assigned: true,
        undo_id: 77,
      }), // chat 1: legitimate commit, title heavily paraphrased by the AI
      jsonResponse(
        stateWith([
          OLD_TASK,
          {
            id: 77,
            title: "Publicar el nuevo portal de documentación",
            status: "pending",
            priority: 1,
            estMin: 60,
          },
        ]),
      ), // state after: one new task, paraphrased title
    ]);

    const result = await registerTask(makeClient(), "Deploy new docs site", "media");

    expect(result.ok).toBe(true);
    expect(result.taskId).toBe(77);
    expect(result.taskTitle).toBe("Publicar el nuevo portal de documentación");
    expect(result.titleMismatch).toBe(true);
    expect(result.hijackedCommit).toBeUndefined();
    expect(result.paulReply).toMatch(/Publicar el nuevo portal/);

    // ZERO assign_undo calls: login + state + chat + state only.
    expect(mock).toHaveBeenCalledTimes(4);
    for (let i = 0; i < 4; i++) {
      expect(callInfo(mock, i).url).not.toContain("action=assign_undo");
    }
  });

  it("reports a hijacked commit without undoing when no undo_id was returned", async () => {
    // The stale pending_assign short-circuit in api.php returns NO undo_id,
    // so a hijack can only be reported — there is no handle to undo it.
    const mock = mockFetchSequence([
      jsonResponse(LOGIN_OK, { cookie: "IVCOACH=a" }),
      jsonResponse(stateWith([OLD_TASK])), // state before
      jsonResponse({
        reply: 'Listo, urgencia alta. Tarea creada: "Llamar al cliente Acme" para Diego.',
        ai: true,
        learned: false,
        assigned: true,
      }), // chat 1: stale assignment committed, no undo handle
      jsonResponse(
        stateWith([
          OLD_TASK,
          { id: 88, title: "Llamar al cliente Acme", status: "pending", priority: 1, estMin: 60 },
        ]),
      ), // state after: one new task, wrong title
    ]);

    const result = await registerTask(makeClient(), "Deploy new docs site", "media");

    expect(result.ok).toBe(false);
    expect(result.taskId).toBeUndefined();
    expect(result.hijackedCommit).toEqual({
      taskId: 88,
      title: "Llamar al cliente Acme",
    });
    expect(result.paulReply).toMatch(/Llamar al cliente Acme/);
    // ZERO assign_undo calls: login + state + chat + state only.
    expect(mock).toHaveBeenCalledTimes(4);
    for (let i = 0; i < 4; i++) {
      expect(callInfo(mock, i).url).not.toContain("action=assign_undo");
    }
  });

  it("accepts a paraphrased two-step commit (urgency asked, no undo_id) as titleMismatch", async () => {
    // The second leg of the ask-urgency flow commits through api.php's
    // pending_assign block, which returns NO undo_id. That commit is still
    // OURS: emitting the urgency question set $_SESSION['pending_assign'] to
    // our request, overwriting any stale one. It must never be classified as
    // a hijacked commit, even when the stored title was paraphrased beyond
    // the fuzzy-match threshold.
    const mock = mockFetchSequence([
      jsonResponse(LOGIN_OK, { cookie: "IVCOACH=a" }),
      jsonResponse(stateWith([OLD_TASK])), // state before
      jsonResponse(URGENCY_QUESTION), // chat 1: PAUL asks 'dime la urgencia'
      jsonResponse({
        reply: 'Listo, urgencia media. 📌 "Reparar validaciones del acceso" quedó en tu lista.',
        ai: true,
        learned: false,
        assigned: true,
      }), // chat 2: pending_assign commit — assigned:true, NO undo_id
      jsonResponse(
        stateWith([
          OLD_TASK,
          // Paraphrased below the 0.5 word-overlap threshold vs the request
          {
            id: 91,
            title: "Reparar validaciones del acceso",
            status: "pending",
            priority: 2,
            estMin: 60,
          },
        ]),
      ), // state after: one new task, paraphrased title
    ]);

    const result = await registerTask(makeClient(), "Fix login form bug", "media");

    expect(result.ok).toBe(true);
    expect(result.taskId).toBe(91);
    expect(result.taskTitle).toBe("Reparar validaciones del acceso");
    expect(result.titleMismatch).toBe(true);
    expect(result.hijackedCommit).toBeUndefined();
    expect(result.paulReply).toMatch(/Reparar validaciones del acceso/);

    // ZERO assign_undo calls: login + state + chat + chat + state only.
    expect(mock).toHaveBeenCalledTimes(5);
    for (let i = 0; i < 5; i++) {
      expect(callInfo(mock, i).url).not.toContain("action=assign_undo");
    }
  });

  it("returns ok:true when the urgency leg fails but verification finds the task", async () => {
    mockFetchSequence([
      jsonResponse(LOGIN_OK, { cookie: "IVCOACH=a" }),
      jsonResponse(stateWith([OLD_TASK])), // state before
      jsonResponse(URGENCY_QUESTION), // chat 1: PAUL asks urgency
      new Error("network down"), // chat 2: transport failure AFTER the request landed
      jsonResponse(
        stateWith([
          OLD_TASK,
          { id: 50, title: "Fix login form bug", status: "pending", priority: 2, estMin: 60 },
        ]),
      ), // state after: the task WAS created
    ]);

    const result = await registerTask(makeClient(), "Fix login form bug", "media");

    expect(result.ok).toBe(true);
    expect(result.taskId).toBe(50);
    expect(result.uncertain).toBeFalsy();
  });

  it("returns uncertain when the urgency leg fails and no new task appeared", async () => {
    mockFetchSequence([
      jsonResponse(LOGIN_OK, { cookie: "IVCOACH=a" }),
      jsonResponse(stateWith([OLD_TASK])), // state before
      jsonResponse(URGENCY_QUESTION), // chat 1: PAUL asks urgency (pending_assign now set)
      new Error("network down"), // chat 2: transport failure
      jsonResponse(stateWith([OLD_TASK])), // state after: nothing new
    ]);

    const result = await registerTask(makeClient(), "Fix login form bug", "media");

    expect(result.ok).toBe(false);
    expect(result.uncertain).toBe(true);
    expect(result.error).toMatch(/network down/);
    // PAUL's reply from the successful first leg is preserved
    expect(result.paulReply).toBe(URGENCY_QUESTION.reply);
    expect(result.hijackedCommit).toBeUndefined();
  });

  it("returns uncertain with null paulReply when the opening message fails", async () => {
    mockFetchSequence([
      jsonResponse(LOGIN_OK, { cookie: "IVCOACH=a" }),
      jsonResponse(stateWith([OLD_TASK])), // state before
      new Error("socket hang up"), // chat 1: transport failure
      jsonResponse(stateWith([OLD_TASK])), // state after: nothing new
    ]);

    const result = await registerTask(makeClient(), "Fix login form bug", "media");

    expect(result.ok).toBe(false);
    expect(result.uncertain).toBe(true);
    expect(result.error).toMatch(/socket hang up/);
    expect(result.paulReply).toBeNull();
  });

  it("never sends urgency words in the opening message (session hijack guard)", async () => {
    const mock = mockFetchSequence([
      jsonResponse(LOGIN_OK, { cookie: "IVCOACH=a" }),
      jsonResponse(stateWith([])),
      jsonResponse(URGENCY_QUESTION),
      jsonResponse({ reply: "Listo, urgencia baja.", ai: true, learned: false, assigned: true }),
      jsonResponse(stateWith([{ id: 9, title: "Deploy docs", status: "pending" }])),
    ]);

    await registerTask(makeClient(), "Deploy docs", "baja");

    const opening = (callInfo(mock, 2).body as { message: string }).message;
    // detect_urgency() in helpers.php matches these; the opening message must avoid all of them
    expect(opening).not.toMatch(/\b(alta|urgente|urge|priorit|media|normal|moderad|regular|baja|sin prisa|cuando puedas|no urge|low)/i);
  });
});
