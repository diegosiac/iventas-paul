// Smoke test — step 2 (WRITES): register a task via the coach_chat dialogue.
// Run from the repo root:
//   node --env-file=.env smoke/step2-register.mjs ["title"] [alta|media|baja]
import { PaulClient, configFromEnv } from "../dist/client.js";
import { registerTask } from "../dist/tools/register-task.js";

const title =
  process.argv[2] ??
  "Integrar agentes de IA con PAUL para registro y cierre de tareas";
const urgency = process.argv[3] ?? "baja";

const client = new PaulClient(configFromEnv());
console.log(`Registering: "${title}" (urgency: ${urgency})\n`);

const result = await registerTask(client, title, urgency);
console.log(JSON.stringify(result, null, 2));
