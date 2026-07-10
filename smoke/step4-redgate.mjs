// Smoke test — step 4 (WRITES): resolve the pending red-gate flag with an
// honest improvement plan, then re-check state to confirm it cleared.
// Run from the repo root:
//   node --env-file=.env smoke/step4-redgate.mjs <flagId> ["plan"]
import { PaulClient, configFromEnv } from "../dist/client.js";

const flagId = Number(process.argv[2]);
const plan =
  process.argv[3] ??
  "De ahora en adelante el agente registrará e iniciará la tarea en PAUL al COMENZAR el trabajo real y la cerrará recién al terminarlo, para que Empezar/Finalizar reflejen la duración verdadera. Esta vez el desarrollo ya estaba terminado cuando registré la tarea de la integración, por eso quedó de 1 minuto.";
if (!Number.isInteger(flagId)) {
  console.error('Usage: node --env-file=.env smoke/step4-redgate.mjs <flagId> ["plan"]');
  process.exit(1);
}

const client = new PaulClient(configFromEnv());

const questions = await client.request("red_gate_questions", { flag_id: flagId });
console.log("Gate question:", questions.questions?.[0]);

const ack = await client.request("red_gate_ack", {
  flag_id: flagId,
  qa: [{ q: questions.questions?.[0] ?? "", a: plan }],
  plan,
});
console.log("\nred_gate_ack:", JSON.stringify(ack, null, 2));

const state = await client.state();
const t480 = state.tasks.find((t) => t.id === 480);
console.log(`\nTask #480 status: ${t480?.status}`);
console.log("Pending red gate:", JSON.stringify(state.pending_red_gate ?? null));
console.log("Red flags this week:", state.red_flags_week ?? 0);
