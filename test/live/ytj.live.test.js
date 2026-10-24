import { test } from "node:test";
import assert from "node:assert/strict";
import { createYtjClient } from "../../services/ytjClient.js";

// Real call to PRH. Opt in with: LIVE=1 npm test
test("live: PRH answers for Nokia", { skip: !process.env.LIVE && "set LIVE=1 to run" }, async () => {
  const company = await createYtjClient().findByBusinessId("0112038-9");
  assert.equal(company.businessId.value, "0112038-9");
});
