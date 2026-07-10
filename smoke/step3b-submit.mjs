// Smoke test — step 3b (WRITES): submit the checkpoint answers; prints PAUL's
// verdict. Answers are read from a JSON file of [{ q, a }] so they can be
// reviewed/edited before sending.
// Run from the repo root:
//   node --env-file=.env smoke/step3b-submit.mjs <taskId> <answers.json>
import { readFile } from "node:fs/promises";
import { PaulClient, configFromEnv } from "../dist/client.js";

const id = Number(process.argv[2]);
const file = process.argv[3];
if (!Number.isInteger(id) || !file) {
  console.error("Usage: node --env-file=.env smoke/step3b-submit.mjs <taskId> <answers.json>");
  process.exit(1);
}

const qa = JSON.parse(await readFile(file, "utf8"));
const client = new PaulClient(configFromEnv());
const verdict = await client.submitValidation(id, qa);
console.log(JSON.stringify(verdict, null, 2));
