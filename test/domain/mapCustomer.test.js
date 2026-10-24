import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeCompany } from "../../domain/normalizeCompany.js";
import { mapCustomer, vatNumberFor } from "../../domain/mapCustomer.js";
import { ytjFixture } from "../helpers/fixtures.js";

const provenance = { source: "dump", fetchedAt: "2026-10-23T04:36:00Z", datasetVersion: 1 };

test("Nokia → customer: external id, VAT, ACTIVE, billing from postal and shipping from visiting", () => {
  const customer = mapCustomer(normalizeCompany(ytjFixture("nokia-api")), { provenance });
  assert.equal(customer.externalId, "0112038-9");
  assert.equal(customer.companyName, "Nokia Oyj");
  assert.equal(customer.altName, "Nokia Abp");
  assert.equal(customer.isPerson, false);
  assert.equal(customer.vatRegistrationNumber, "FI01120389");
  assert.equal(customer.entityStatus, "ACTIVE");
  assert.equal(customer.industryCode, "70100");
  assert.equal(customer.industry, "Activities of head offices");
  assert.equal(customer.companyFormCode, "17");
  assert.equal(customer.companyForm, "Public limited company");
  assert.equal(customer.subsidiary, "FI");
  assert.equal(customer.currency, "EUR");
  assert.equal(customer.url, "www.nokia.com");
  assert.deepEqual(customer.addressbook, [
    { label: "Billing", defaultBilling: true, defaultShipping: false, addr1: "PL 226", zip: "00045", city: "Nokia Group", country: "FI" },
    { label: "Shipping", defaultBilling: false, defaultShipping: true, addr1: "Karakaari 7", zip: "02610", city: "Espoo", country: "FI" },
  ]);
  assert.equal(customer.custentity_ytj_source, "dump");
  assert.equal(customer.custentity_ytj_dataset_version, 1);
  assert.equal(customer.custentity_ytj_situation, null);
});

test("no VAT number unless PRH shows VAT liability; INACTIVE for bankruptcy", () => {
  const customer = mapCustomer(normalizeCompany(ytjFixture("bankrupt")));
  assert.equal(customer.entityStatus, "INACTIVE");
  assert.equal(customer.custentity_ytj_situation, "bankruptcy");
  const housing = mapCustomer(normalizeCompany(ytjFixture("housing-company")));
  assert.equal(housing.vatRegistrationNumber, null);
});

test("a single address serves both billing and shipping; none gives an empty addressbook", () => {
  const one = mapCustomer(normalizeCompany(ytjFixture("sole-trader-like-ay-with-aux-names")));
  assert.equal(one.addressbook.length, 1);
  assert.deepEqual([one.addressbook[0].label, one.addressbook[0].defaultBilling, one.addressbook[0].defaultShipping], ["Primary", true, true]);
  const none = mapCustomer(normalizeCompany(ytjFixture("dissolved")));
  assert.deepEqual(none.addressbook, []);
});

test("register defaults are configurable and provenance defaults to null", () => {
  const customer = mapCustomer(normalizeCompany(ytjFixture("nokia-api")), { defaults: { subsidiary: "Helsinki Cars Oy", currency: "SEK" } });
  assert.equal(customer.subsidiary, "Helsinki Cars Oy");
  assert.equal(customer.currency, "SEK");
  assert.equal(customer.custentity_ytj_source, null);
});

test("vatNumberFor derives the Finnish VAT number from the business ID", () => {
  assert.equal(vatNumberFor("1927400-1"), "FI19274001");
});
