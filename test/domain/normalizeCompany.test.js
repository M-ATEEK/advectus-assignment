import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeCompany } from "../../domain/normalizeCompany.js";
import { ytjFixture } from "../helpers/fixtures.js";

test("Nokia (API capture): names, codes in three languages, both addresses, VAT, active", () => {
  const c = normalizeCompany(ytjFixture("nokia-api"));
  assert.equal(c.businessId, "0112038-9");
  assert.equal(c.euId, "FIFPRO.0112038-9");
  assert.equal(c.name, "Nokia Oyj");
  assert.deepEqual(c.parallelNames, ["Nokia Abp", "Nokia Corporation"]);
  assert.ok(c.auxiliaryNames.includes("Vertu"));
  assert.ok(!c.auxiliaryNames.includes("Oy Nokia Ab"), "historical primary name is not a current name");
  assert.deepEqual(c.companyForm, { code: "17", fi: "Julkinen osakeyhtiö", sv: "Publikt aktiebolag", en: "Public limited company" });
  assert.equal(c.mainBusinessLine.code, "70100");
  assert.equal(c.mainBusinessLine.en, "Activities of head offices");
  assert.deepEqual(c.status, {
    active: true,
    registered: true,
    ceasedAt: null,
    situation: null,
    codes: { status: "2", tradeRegisterStatus: "1" },
  });
  assert.equal(c.vatLiable, true);
  assert.equal(c.addresses.visiting.street, "Karakaari 7");
  assert.equal(c.addresses.visiting.city, "Espoo");
  assert.equal(c.addresses.visiting.postCode, "02610");
  assert.equal(c.addresses.visiting.country, "FI");
  assert.equal(c.addresses.postal.street, "PL 226");
  assert.equal(c.addresses.postal.parts.postOfficeBox, "226");
  assert.equal(c.website, "www.nokia.com");
  assert.equal(c.registrationDate, "1896-12-19");
  assert.match(c.lastModified, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
});

test("dump records use the same shape; lastModified with a space is normalised", () => {
  const c = normalizeCompany(ytjFixture("housing-company"));
  assert.equal(c.businessId, "0184194-4");
  assert.equal(c.name, "Asunto Oy Vaasan Suvikartano");
  assert.equal(c.companyForm.code, "2");
  assert.equal(c.companyForm.en, "Housing corporation");
  assert.equal(c.status.active, true);
  assert.match(c.lastModified, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  assert.equal(c.vatLiable, false, "housing companies are normally not VAT-liable for business");
});

test("bankruptcy and liquidation make a company inactive even without an end date", () => {
  const bankrupt = normalizeCompany(ytjFixture("bankrupt"));
  assert.equal(bankrupt.status.situation, "bankruptcy");
  assert.equal(bankrupt.status.active, false);
  assert.equal(bankrupt.status.ceasedAt, null);

  const liquidation = normalizeCompany(ytjFixture("liquidation"));
  assert.equal(liquidation.status.situation, "liquidation");
  assert.equal(liquidation.status.active, false);
});

test("a dissolved company is inactive with ceasedAt set and may have no addresses", () => {
  const c = normalizeCompany(ytjFixture("dissolved"));
  assert.equal(c.status.active, false);
  assert.equal(c.status.ceasedAt, "2009-02-25");
  assert.deepEqual(c.addresses, { visiting: null, postal: null });
});

test("a company with no current primary name yields name null, never a historical name", () => {
  const c = normalizeCompany(ytjFixture("po-box-no-current-name"));
  assert.equal(c.name, null);
  assert.equal(c.addresses.postal.street.startsWith("PL "), true);
});

test("limited partnership keeps its parallel (Swedish) name and form code 13", () => {
  const c = normalizeCompany(ytjFixture("limited-partnership"));
  assert.equal(c.companyForm.code, "13");
  assert.equal(c.companyForm.en, "Limited partnership");
  assert.ok(c.parallelNames.length >= 1);
});

test("missing arrays never throw", () => {
  const c = normalizeCompany({ businessId: { value: "0112038-9" } });
  assert.equal(c.name, null);
  assert.deepEqual(c.parallelNames, []);
  assert.equal(c.companyForm, null);
  assert.equal(c.mainBusinessLine, null);
  assert.equal(c.status.active, true);
  assert.equal(c.vatLiable, false);
  assert.deepEqual(c.addresses, { visiting: null, postal: null });
});
