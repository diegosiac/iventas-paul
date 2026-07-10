import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PaulClient, PaulTask } from "../client.js";
import { textResult, errorResult } from "./shared.js";

export type Urgency = "alta" | "media" | "baja";

export interface HijackedCommit {
  taskId: number;
  title: string;
}

export interface RegisterResult {
  ok: boolean;
  taskId?: number;
  taskTitle?: string;
  /**
   * The task WAS created from our request, but PAUL's AI rewrote the title
   * beyond the fuzzy-match threshold. Proven by either signal: the reply
   * carried an undo_id (only the legitimate direct self-assign commit path
   * returns one), or PAUL asked us the urgency question first (asking sets
   * the server session's pending_assign to OUR request, so the urgency leg's
   * commit — which returns no undo_id — is still ours). `taskTitle` holds
   * the stored title so the caller can judge the divergence.
   */
  titleMismatch?: boolean;
  /**
   * A task whose title does NOT match the request was committed on the
   * OPENING message WITHOUT an undo handle and WITHOUT PAUL ever asking the
   * urgency question — the stale pending_assign short-circuit in the server
   * session hijacked it. A hijack after PAUL asks is impossible: asking
   * overwrites the stale pending with ours. Report-only: that path never
   * returns an undo_id, so it cannot be undone from here.
   */
  hijackedCommit?: HijackedCommit;
  /**
   * The dialogue was interrupted by a transport error and verification found
   * no matching task; a pending assignment may be dangling server-side.
   * Check the task list (paul_tasks) before retrying.
   */
  uncertain?: boolean;
  /**
   * The title was rejected BEFORE any network call: it contains a word
   * matched by detect_urgency() in lib/helpers.php, which could commit a
   * stale pending assignment sitting in the server session. `error` names
   * the offending word; rephrase the title and retry.
   */
  titleRejected?: true;
  /** Error message when `uncertain` or `titleRejected` is set. */
  error?: string;
  /** PAUL's last reply verbatim — preserved so the caller can react; null when no reply arrived. */
  paulReply: string | null;
}

/**
 * Opening chat message. It must NOT contain any word matched by
 * detect_urgency() in lib/helpers.php (alta/media/baja/urgente/normal/...):
 * if a stale pending_assign is sitting in the server session, an urgency word
 * in this message would commit that OLD assignment instead of ours.
 */
function openingMessage(title: string): string {
  return `Necesito registrar una tarea nueva en mi lista, es para mí: "${title}".`;
}

/**
 * Mirror of detect_urgency() in lib/helpers.php:1007-1013 — \b-bounded and
 * case-insensitive, with 'moderad' matching as a prefix (moderada, moderado,
 * ...). The wrapper text of openingMessage() is urgency-free, but the TITLE
 * is interpolated into it: a title containing any of these words would let
 * the NEXT coach_chat message commit a stale $_SESSION['pending_assign']
 * instead of registering our task, so such titles are rejected up front.
 */
const URGENCY_WORD_RE =
  /\b(alta|urgente|urge|prioritario|media|normal|moderad\w*|regular|baja|sin prisa|cuando puedas|no urge|low)\b/i;

/**
 * Heuristic: does PAUL's reply ask for the urgency level? Matches the real
 * question emitted by api.php ('... dime la urgencia: ¿**alta**, **media** o
 * **baja**?') robustly rather than by exact string. Besides driving the
 * second dialogue leg, this signal marks the commit that follows as OURS:
 * asking the question is the only place the server sets pending_assign, and
 * it sets it to our request.
 */
function asksForUrgency(reply: string): boolean {
  // /urgencia/i covers the canonical 'dime la urgencia' phrasing and minor
  // rewrites of it; the alta+media+baja triple catches wordings without it.
  if (/urgencia/i.test(reply)) return true;
  return /alta/i.test(reply) && /media/i.test(reply) && /baja/i.test(reply);
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fuzzy title match: PAUL's AI often rewrites the title it stores. */
function titlesMatch(requested: string, stored: string): boolean {
  const a = normalize(requested);
  const b = normalize(stored);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const wordsA = new Set(a.split(" ").filter((w) => w.length > 2));
  const wordsB = b.split(" ").filter((w) => w.length > 2);
  if (wordsA.size === 0 || wordsB.length === 0) return false;
  const common = wordsB.filter((w) => wordsA.has(w)).length;
  return common / Math.min(wordsA.size, wordsB.length) >= 0.5;
}

/**
 * Registers a new task for the authenticated user through the coach_chat
 * dialogue, then verifies against `state` that the task really exists.
 *
 * Flow (mirrors api.php case 'coach_chat' + lib/assign.php):
 * 1. Snapshot state to know which task ids already exist.
 * 2. Send the opening message (title only, no urgency words).
 *    If PAUL asks for urgency, answer with the bare urgency word.
 *    A transport failure here does NOT abort: the request may have landed
 *    server-side, so verification still runs.
 * 3. Fetch state again and look for a NEW task (id not in the snapshot).
 *    A new task is accepted ONLY when its title matches the request: a stale
 *    pending_assign in the server session can commit a DIFFERENT task (see
 *    api.php's pending_assign short-circuit) that must never be reported as
 *    ours. When exactly one new NON-matching task appeared, two signals tell
 *    the cases apart:
 *    - undo_id present: only the legitimate direct self-assign commit path
 *      returns one, so OUR task was created with a paraphrased title
 *      (titleMismatch).
 *    - PAUL asked the urgency question (askedUrgency): emitting that question
 *      is the ONLY place api.php sets $_SESSION['pending_assign'], and it
 *      sets it to OUR request — overwriting any stale one. The urgency leg's
 *      commit then goes through the pending_assign block, which returns NO
 *      undo_id but is still ours (titleMismatch). A hijack on that leg is
 *      impossible: the stale short-circuit never asks, it only commits.
 *    - Neither: a commit landed on the OPENING leg without an undo handle,
 *      which only the stale pending_assign short-circuit produces — a
 *      hijacked commit (report-only — that path returns no undo handle, so
 *      nothing is ever auto-undone).
 */
export async function registerTask(
  client: Pick<PaulClient, "coachChat" | "state">,
  title: string,
  urgency: Urgency,
): Promise<RegisterResult> {
  // Pre-flight guard, BEFORE any network call: an urgency-trigger word in the
  // title travels inside the opening message and detect_urgency() would read
  // it as an urgency answer, committing any stale pending assignment sitting
  // in the server session (lib/helpers.php:1007-1013).
  const urgencyWord = URGENCY_WORD_RE.exec(title)?.[1];
  if (urgencyWord !== undefined) {
    return {
      ok: false,
      titleRejected: true,
      error:
        `The title contains an urgency-trigger word ("${urgencyWord}") that could make ` +
        "PAUL's session commit a stale pending assignment instead of this task. " +
        "Rephrase the title without it and retry.",
      paulReply: null,
    };
  }

  const before = await client.state();
  const existingIds = new Set(before.tasks.map((t) => t.id));

  let lastReply: string | null = null;
  let undoId: number | null = null;
  let askedUrgency = false;
  let dialogueError: string | null = null;

  try {
    const first = await client.coachChat(openingMessage(title));
    lastReply = first.reply;
    if (typeof first.undo_id === "number") undoId = first.undo_id;

    if (first.assigned !== true && asksForUrgency(first.reply)) {
      // PAUL explicitly asked for the urgency. Emitting that question is the
      // only place api.php sets $_SESSION['pending_assign'], and it set it to
      // OUR request — so whatever the urgency leg commits is ours, even
      // though the pending_assign commit path returns no undo_id.
      askedUrgency = true;
      const second = await client.coachChat(urgency);
      lastReply = second.reply;
      if (typeof second.undo_id === "number") undoId = second.undo_id;
    }
  } catch (err) {
    dialogueError = err instanceof Error ? err.message : String(err);
  }

  // Defensive verification: never trust the dialogue alone. Best-effort even
  // when the dialogue itself was interrupted.
  let newTasks: PaulTask[] = [];
  let verifyError: string | null = null;
  try {
    const after = await client.state();
    newTasks = after.tasks.filter((t) => !existingIds.has(t.id));
  } catch (err) {
    verifyError = err instanceof Error ? err.message : String(err);
  }

  const match = newTasks.find((t) => titlesMatch(title, t.title));
  if (match) {
    return { ok: true, taskId: match.id, taskTitle: match.title, paulReply: lastReply };
  }

  if (dialogueError !== null || verifyError !== null) {
    // Interrupted flow with no matching task confirmed: the opening message
    // may have left a pending assignment dangling server-side. The caller
    // must check the task list before retrying (a blind retry can duplicate).
    return {
      ok: false,
      uncertain: true,
      error: dialogueError ?? verifyError ?? "unknown",
      paulReply: lastReply,
    };
  }

  if (newTasks.length === 1) {
    // Exactly one new task appeared but its title does not fuzzy-match.
    // Two signals disambiguate (see api.php coach_chat):
    // - undo_id present: only the legitimate direct self-assign commit path
    //   returns it, so PAUL processed OUR message and created OUR task — the
    //   AI just rewrote the title beyond the match threshold. Never undo it.
    // - askedUrgency: PAUL asked the urgency question, which set the server
    //   session's pending_assign to OUR request (overwriting any stale one).
    //   The urgency leg's commit goes through the pending_assign block and
    //   returns NO undo_id, yet it is still ours. A hijack after the question
    //   is impossible: the stale short-circuit never asks, it only commits.
    // - Neither: a commit landed on the OPENING leg without an undo handle —
    //   only the stale pending_assign short-circuit does that, so a DIFFERENT
    //   task was committed. That path returns no undo handle, so it can only
    //   be reported.
    const suspect = newTasks[0];
    if (undoId !== null || askedUrgency) {
      return {
        ok: true,
        taskId: suspect.id,
        taskTitle: suspect.title,
        titleMismatch: true,
        paulReply: lastReply,
      };
    }
    return {
      ok: false,
      hijackedCommit: { taskId: suspect.id, title: suspect.title },
      paulReply: lastReply,
    };
  }

  return { ok: false, paulReply: lastReply };
}

export function registerRegisterTaskTool(server: McpServer, client: PaulClient): void {
  server.registerTool(
    "paul_register_task",
    {
      title: "Register a new task in PAUL",
      description:
        "Register a NEW task for yourself in PAUL via its coach chat dialogue. " +
        "There is no direct create-task API: this tool talks to PAUL, answers its " +
        "urgency question, and then VERIFIES against the task list that the task " +
        "was really created with a matching title. Returns { ok: true, taskId } on " +
        "success. { ok: true, taskId, taskTitle, titleMismatch: true } means the " +
        "task WAS created from your request but PAUL rewrote the title — check " +
        "taskTitle to see what was stored (this includes the two-step flow: once " +
        "PAUL asks the urgency question the pending assignment is YOURS, so the " +
        "commit that answers it is legitimate even though that path returns no " +
        "undo handle). Non-ok outcomes (all include paulReply, " +
        "PAUL's actual reply): { ok: false, hijackedCommit } means a stale pending " +
        "assignment in the server session committed a DIFFERENT task on the " +
        "OPENING message — PAUL never asked anything, NOT your " +
        "request — that wrong task still exists (the server returns no undo handle " +
        "on that path, so it cannot be auto-undone); verify with paul_tasks before " +
        "retrying. { ok: false, uncertain: true, " +
        "error } means the dialogue was interrupted mid-flight — the task (or a " +
        "dangling pending assignment) may exist server-side, so CHECK paul_tasks " +
        "before retrying; a blind retry can duplicate it. Plain { ok: false } " +
        "means the dialogue did not converge — read paulReply and react (e.g. " +
        "retry with a clearer title, or use paul_chat to continue the " +
        "conversation). Keep titles short, concrete and action-oriented, and " +
        "NEVER include urgency words (alta/media/baja/urgente/normal/regular/" +
        "low/...): such titles are rejected up front ({ ok: false, " +
        "titleRejected: true }, no API call) because they could make PAUL's " +
        "session commit a stale pending assignment — rephrase and retry. Note: " +
        "PAUL may slightly reword the title. Use this when the user finished work " +
        "that has no matching task yet; afterwards run the close flow " +
        "(paul_start_task, paul_get_checkpoint, paul_submit_checkpoint).",
      inputSchema: {
        title: z.string().min(3).describe("Short, concrete task title (what was/will be done)"),
        urgency: z
          .enum(["alta", "media", "baja"])
          .describe("Urgency level PAUL expects: alta (high), media (medium), baja (low)"),
      },
    },
    async ({ title, urgency }) => {
      try {
        const result = await registerTask(client, title, urgency);
        return textResult(result, !result.ok);
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
