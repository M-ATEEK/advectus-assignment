import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveRow } from "../../services/resolveRow.js";
import { normalizeCompany } from "../../domain/normalizeCompany.js";
import { normalizeName } from "../../domain/names.js";
import { ytjFixture } from "../helpers/fixtures.js";

/** Builds a companies-table row the way the loader does. */
const row = (fixture, overrides = {}) => {
  const data = normalizeCompany(ytjFixture(fixture));
  return { businessId: data.businessId, name: data.name, nameNorm: normalizeName(data.name), altNamesNorm: data.parallelNames.map(normalizeName), active: data.status.active, data, source: "dump", fetchedAt: new Date("2026-10-23"), datasetVersionId: 1, ...overrides };
};
const nokia = row("nokia-api");
const housing = row("housing-company");
const unavailable = Object.assign(new Error("PRH open data API is unavailable: timeout"), { code: "YTJ_UNAVAILABLE" });
const lookup = ({ byId = {}, byName = {} } = {}) => ({
  findByBusinessId: async (id) => byId[id] ?? null,
  findByName: async (name) => byName[normalizeName(name)] ?? [],
});
const id = (value, valid = true) => ({ input: value, normalized: value, valid, reason: valid ? null : "CHECKSUM" });

test("valid id found → matched by business-id, customer record attached", async () => {
  const out = await resolveRow({ businessId: id("0112038-9"), name: "Nokia Oyj" }, lookup({ byId: { "0112038-9": nokia } }));
  assert.equal(out.status, "matched");
  assert.equal(out.result.confidence, "business-id");
  assert.deepEqual(out.result.warnings, []);
  assert.equal(out.result.company.name, "Nokia Oyj");
  assert.equal(out.result.customer.externalId, "0112038-9");
  assert.equal(out.result.customer.custentity_ytj_source, "dump");
});

test("id found but the CSV name is not one of the company's names → matched with NAME_MISMATCH", async () => {
  const out = await resolveRow({ businessId: id("0112038-9"), name: "Kone Oyj" }, lookup({ byId: { "0112038-9": nokia } }));
  assert.equal(out.status, "matched");
  assert.deepEqual(out.result.warnings, ["NAME_MISMATCH"]);
});

test("a parallel name counts as the company's name", async () => {
  const out = await resolveRow({ businessId: id("0112038-9"), name: "nokia corporation" }, lookup({ byId: { "0112038-9": nokia } }));
  assert.deepEqual(out.result.warnings, []);
});

test("id not found, no name → not_found; id not found with name → name path with a warning", async () => {
  assert.equal((await resolveRow({ businessId: id("1234567-1"), name: null }, lookup())).status, "not_found");
  const out = await resolveRow({ businessId: id("1234567-1"), name: "Nokia Oyj" }, lookup({ byName: { "nokia oyj": [nokia] } }));
  assert.equal(out.status, "matched");
  assert.equal(out.result.confidence, "name-exact");
  assert.deepEqual(out.result.warnings, ["ID_NOT_FOUND_USED_NAME"]);
});

test("invalid id with a name → matched by name with INVALID_BUSINESS_ID; invalid id alone → invalid", async () => {
  const out = await resolveRow({ businessId: id("0112038-8", false), name: "Nokia Oyj" }, lookup({ byName: { "nokia oyj": [nokia] } }));
  assert.equal(out.status, "matched");
  assert.deepEqual(out.result.warnings, ["INVALID_BUSINESS_ID"]);
  assert.equal((await resolveRow({ businessId: id("ABC", false), name: null }, lookup())).status, "invalid");
});

test("several exact name hits → ambiguous with candidates; active ones win over inactive", async () => {
  const inactiveTwin = row("nokia-api", { businessId: "1111111-1", active: false });
  const activeTwin = row("nokia-api", { businessId: "2222222-2" });
  const two = await resolveRow({ businessId: null, name: "Nokia Oyj" }, lookup({ byName: { "nokia oyj": [nokia, activeTwin] } }));
  assert.equal(two.status, "ambiguous");
  assert.deepEqual(two.result.candidates.map((c) => c.businessId), ["0112038-9", "2222222-2"]);
  assert.equal(two.result.candidates[0].companyForm, "Public limited company");

  const one = await resolveRow({ businessId: null, name: "Nokia Oyj" }, lookup({ byName: { "nokia oyj": [nokia, inactiveTwin] } }));
  assert.equal(one.status, "matched", "only one active candidate");
});

test("no name hit → not_found", async () => {
  assert.equal((await resolveRow({ businessId: null, name: "Olematon Oy" }, lookup())).status, "not_found");
});

test("PRH unavailable → pending with PRH_UNAVAILABLE; any other error → error", async () => {
  const down = { findByBusinessId: async () => { throw unavailable; }, findByName: async () => { throw unavailable; } };
  const out = await resolveRow({ businessId: id("1234567-1"), name: null }, down);
  assert.equal(out.status, "pending");
  assert.deepEqual(out.result.warnings, ["PRH_UNAVAILABLE"]);
  assert.match(out.error, /unavailable/);

  const broken = { findByBusinessId: async () => { throw new Error("db connection lost"); } };
  const err = await resolveRow({ businessId: id("0112038-9"), name: null }, broken);
  assert.equal(err.status, "error");
  assert.equal(err.error, "db connection lost");
  assert.equal(housing.active, true);
});
