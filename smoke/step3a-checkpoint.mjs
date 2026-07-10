// Smoke test — step 3a (WRITES): start the task and request the 3 validation
// questions (begins the close flow).
// Run from the repo root: node --env-file=.env smoke/step3a-checkpoint.mjs <taskId>
import { PaulClient, configFromEnv } from "../dist/client.js";

const id = Number(process.argv[2]);
if (!Number.isInteger(id)) {
  console.error("Usage: node --env-file=.env smoke/step3a-checkpoint.mjs <taskId>");
  process.exit(1);
}

const client = new PaulClient(configFromEnv());

const started = await client.startTask(id);
console.log("start_task:", JSON.stringify(started));

const checkpoint = await client.requestQuestions(id);
console.log(`\nAI-generated: ${checkpoint.ai}${checkpoint.reason ? ` (reason: ${checkpoint.reason})` : ""}`);
console.log("\nQuestions:");
checkpoint.questions.forEach((q, i) => console.log(`  ${i + 1}. ${q}`));
