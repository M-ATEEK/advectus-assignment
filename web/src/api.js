const BASE = "/api/v1";

/** Unwraps the API envelope; throws an Error with the server's message on failure. */
const call = async (path, options) => {
  const res = await fetch(`${BASE}${path}`, options);
  const body = await res.json();
  if (!body.success) throw new Error(body.error?.message ?? `HTTP ${res.status}`);
  return body;
};

export const uploadCsv = (file) => {
  const form = new FormData();
  form.append("file", file, file.name);
  return call("/uploads", { method: "POST", body: form }).then((b) => b.data.upload);
};

export const inspectUpload = (uploadId) => call(`/uploads/${uploadId}/inspect?maxRows=5000`).then((b) => b.data.inspection);

export const startEnrichment = (uploadId) =>
  call("/enrichments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ uploadId }) }).then(
    (b) => b.data.job,
  );

export const getJob = (jobId) => call(`/enrichments/${jobId}`).then((b) => b.data.job);

export const getResults = (jobId, status) =>
  call(`/enrichments/${jobId}/results?limit=1000${status ? `&status=${status}` : ""}`).then((b) => b.data.results);
