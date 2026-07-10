// Smoke test — step 1 (read-only): login + list tasks.
// Run from the repo root: node --env-file=.env smoke/step1-state.mjs
import { PaulClient, configFromEnv } from "../dist/client.js";

const client = new PaulClient(configFromEnv());
const state = await client.state();

console.log(`Logged in as: ${state.user.name} (${state.user.role})`);
console.log(`Week: ${state.week.start} → ${state.week.end}`);
console.log(`Moves left: ${state.moves_left}\n`);

const counts = {};
for (const t of state.tasks) counts[t.status] = (counts[t.status] ?? 0) + 1;
console.log("Tasks by status:", counts);

console.log("\nTasks:");
for (const t of state.tasks) {
  console.log(`  #${t.id} [${t.status}] ${t.title}`);
}
