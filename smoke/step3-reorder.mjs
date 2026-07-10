// Smoke test — step 3 pre-req (WRITES, spends 1 weekly priority move): move a
// pending task to the top of the list so start_task accepts it.
// Run from the repo root:
//   node --env-file=.env smoke/step3-reorder.mjs <taskId> "<reason>"
import { PaulClient, configFromEnv } from "../dist/client.js";

const id = Number(process.argv[2]);
const reason = process.argv[3] ?? "Cerrar la integración de agentes de IA con PAUL que ya está terminada";
if (!Number.isInteger(id)) {
  console.error('Usage: node --env-file=.env smoke/step3-reorder.mjs <taskId> "<reason>"');
  process.exit(1);
}

const client = new PaulClient(configFromEnv());
const result = await client.request("reorder_task", { id, to: 0, reason });
console.log(JSON.stringify(result, null, 2));
