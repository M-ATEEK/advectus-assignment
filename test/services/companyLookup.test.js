import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createCompanyLookup } from "../../services/companyLookup.js";
import { saveApiCompanies } from "../../services/companies.js";
import { Company } from "../../models/index.js";
import { closeDatabase, resetDatabase } from "../helpers/app.js";
import { ytjFixture } from "../helpers/fixtures.js";

const nokia = ytjFixture("nokia-api");
const kone = { ...ytjFixture("housing-company"), businessId: { value: "1927400-1" } };

before(resetDatabase);
after(closeDatabase);

test("write-through inserts missing companies only and never overwrites a register row", async () => {
  const housing = ytjFixture("housing-company"); // 0184194-4
  const bankrupt = ytjFixture("bankrupt"); // 0184443-2
  await Company.create({ businessId: "0184194-4", name: "Old Name Oy", nameNorm: "old name oy", active: true, data: { businessId: "0184194-4" }, source: "dump", datasetVersionId: 1, fetchedAt: new Date("2026-10-23") });

  const stored = await saveApiCompanies([housing, bankrupt]);
  assert.deepEqual(stored.map((c) => [c.businessId, c.source]).sort(), [["0184194-4", "dump"], ["0184443-2", "api"]]);
  assert.equal((await Company.findByPk("0184194-4")).name, "Old Name Oy", "register row untouched");
  await Company.destroy({ where: { businessId: ["0184194-4", "0184443-2"] } });
});

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

test("findByName: local exact match first, otherwise one PRH search whose hits are written through and filtered exactly", async () => {
  const lookup = createCompanyLookup({ ytj: { searchByName: async () => [kone] } });
  const local = await lookup.findByName("  NOKIA OYJ ");
  assert.equal(local.length, 1, "Nokia was written through by the previous test and matches after normalising");
  assert.equal(local[0].businessId, "0112038-9");

  const remote = await lookup.findByName("Asunto Oy Vaasan Suvikartano");
  assert.equal(remote.length, 1);
  assert.equal(remote[0].businessId, "1927400-1");
  assert.equal((await Company.findByPk("1927400-1")).source, "api");

  assert.deepEqual(await lookup.findByName("Something Else Oy"), [], "PRH hit that is not an exact name match is not a candidate");
  assert.deepEqual(await lookup.findByName("   "), []);
});
