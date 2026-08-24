import { expiredSystemTests, markSystemTestCleaned } from "./db.js";
import { deleteSystemTestPrefix } from "./storage.js";

export async function cleanupExpiredSystemTests() {
  const runs = await expiredSystemTests();
  for (const run of runs) {
    await deleteSystemTestPrefix(run.id);
    await markSystemTestCleaned(run.id, run.projectId);
    console.log(JSON.stringify({ event: "system_test_cleaned", runId: run.id }));
  }
}
