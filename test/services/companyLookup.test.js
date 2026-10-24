import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createCompanyLookup } from "../../services/companyLookup.js";
import { Company } from "../../models/index.js";
import { closeDatabase, resetDatabase } from "../helpers/app.js";
import { ytjFixture } from "../helpers/fixtures.js";

const nokia = ytjFixture("nokia-api");
const kone = { ...ytjFixture("housing-company"), businessId: { value: "1927400-1" } };

before(resetDatabase);
after(closeDatabase);

test("local hit never calls PRH", async () => {
  await Company.create({ businessId: "0184443-2", name: "Kätevä-Tuote Oy", nameNorm: "kateva tuote oy", active: false, data: { businessId: "0184443-2" }, source: "dump", fetchedAt: new Date() });
  let calls = 0;
  const lookup = createCompanyLookup({ ytj: { findByBusinessId: async () => (calls++, nokia) } });
  const found = await lookup.findByBusinessId("0184443-2");
  assert.equal(found.name, "Kätevä-Tuote Oy");
  assert.equal(calls, 0);
});

test("local miss asks PRH and writes the answer through with source api", async () => {
  const lookup = createCompanyLookup({ ytj: { findByBusinessId: async (id) => (id === "0112038-9" ? nokia : null) } });
  const found = await lookup.findByBusinessId("0112038-9");
  assert.equal(found.name, "Nokia Oyj");
  assert.equal(found.source, "api");
  const stored = await Company.findByPk("0112038-9");
  assert.equal(stored.source, "api");
  assert.equal(stored.datasetVersionId, null);
  assert.equal(stored.data.companyForm.en, "Public limited company");

  assert.equal(await lookup.findByBusinessId("1234567-1"), null);
});

test("remote name search writes every hit through", async () => {
  const lookup = createCompanyLookup({ ytj: { searchByName: async () => [kone] } });
  const hits = await lookup.searchByNameRemote("kone");
  assert.equal(hits.length, 1);
  assert.equal((await Company.findByPk("1927400-1")).source, "api");
});
