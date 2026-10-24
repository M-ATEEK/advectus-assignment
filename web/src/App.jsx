import { useEffect, useState } from "react";
import { getJob, getResults, inspectUpload, startEnrichment, uploadCsv } from "./api.js";

const FINISHED = ["done", "partial", "failed"];
const STATUSES = ["", "matched", "ambiguous", "not_found", "invalid", "pending", "error"];

export default function App() {
  const [file, setFile] = useState(null);
  const [upload, setUpload] = useState(null);
  const [inspection, setInspection] = useState(null);
  const [job, setJob] = useState(null);
  const [results, setResults] = useState([]);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onUpload = () =>
    run(async () => {
      setJob(null);
      setResults([]);
      const up = await uploadCsv(file);
      setUpload(up);
      setInspection(await inspectUpload(up.id));
    });

  const onStart = () => run(async () => setJob(await startEnrichment(upload.id)));

  // Poll the job every 2 s until it finishes, then load the results.
  useEffect(() => {
    if (!job || FINISHED.includes(job.status)) return undefined;
    const timer = setInterval(() => getJob(job.id).then(setJob).catch((err) => setError(err.message)), 2000);
    return () => clearInterval(timer);
  }, [job]);

  useEffect(() => {
    if (!job || !FINISHED.includes(job.status)) return;
    getResults(job.id, filter).then(setResults).catch((err) => setError(err.message));
  }, [job, filter]);

  return (
    <main>
      <h1>Business ID enrichment</h1>
      <p className="muted">Upload a CSV with business IDs and/or company names. Rows are completed from PRH's open YTJ data.</p>

      <section>
        <h2>1. Upload</h2>
        <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files[0] ?? null)} />
        <button onClick={onUpload} disabled={!file || busy}>Upload</button>
        {inspection && <Inspection upload={upload} inspection={inspection} />}
      </section>

      {inspection?.usable && (
        <section>
          <h2>2. Enrich</h2>
          <button onClick={onStart} disabled={busy || (job && !FINISHED.includes(job.status))}>Start enrichment</button>
          {job && <JobStatus job={job} />}
        </section>
      )}

      {job && FINISHED.includes(job.status) && (
        <section>
          <h2>3. Results</h2>
          <label>
            Show{" "}
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s || "all"}</option>
              ))}
            </select>
          </label>{" "}
          <a href={`/api/v1/enrichments/${job.id}/results`} target="_blank" rel="noreferrer">Open JSON</a>
          <ResultsTable results={results} />
        </section>
      )}

      {error && <p className="error">{error}</p>}
    </main>
  );
}

function Inspection({ upload, inspection }) {
  const { rows, columns, format, warnings, usable } = inspection;
  return (
    <div className="card">
      <p>
        <strong>{upload.fileName}</strong> · {Math.round(upload.bytes / 1024)} KB · delimiter "{format.delimiter}" ·{" "}
        {format.hasHeader ? "header row" : "no header"}
      </p>
      <p>
        {rows.dataRows} rows · {rows.withBusinessId} with business ID ({rows.invalidBusinessIds} invalid, {rows.duplicateBusinessIds} duplicates) ·{" "}
        {rows.withName} with name
      </p>
      <p>
        Columns: business ID = {columns.businessId ? `#${columns.businessId.index + 1} ${columns.businessId.header ?? ""}` : "none"},
        name = {columns.name ? `#${columns.name.index + 1} ${columns.name.header ?? ""}` : "none"}
      </p>
      {warnings.length > 0 && (
        <ul className="warnings">
          {warnings.map((w) => <li key={w.code}>{w.message}</li>)}
        </ul>
      )}
      {!usable && <p className="error">This file cannot be enriched.</p>}
    </div>
  );
}

function JobStatus({ job }) {
  const counts = job.counters?.rows;
  return (
    <div className="card">
      <p>
        Job <code>{job.id}</code> · <span className={`badge ${job.status}`}>{job.status}</span>
        {job.totalRows !== null && <> · {job.totalRows} rows</>}
        {!FINISHED.includes(job.status) && <> · working…</>}
      </p>
      {counts && (
        <p>
          matched {counts.matched} · ambiguous {counts.ambiguous} · not found {counts.not_found} · invalid {counts.invalid} ·
          pending {counts.pending} · error {counts.error}
        </p>
      )}
      {job.error && <p className="error">{job.error}</p>}
    </div>
  );
}

function ResultsTable({ results }) {
  if (results.length === 0) return <p className="muted">No rows.</p>;
  return (
    <table>
      <thead>
        <tr>
          <th>#</th><th>Input ID</th><th>Input name</th><th>Status</th><th>Company</th><th>Business ID</th><th>Form</th><th>City</th><th>VAT</th><th>Notes</th>
        </tr>
      </thead>
      <tbody>
        {results.map((r) => (
          <tr key={r.rowNumber}>
            <td>{r.rowNumber}</td>
            <td>{r.input.businessId?.input ?? ""}</td>
            <td>{r.input.name ?? ""}</td>
            <td><span className={`badge ${r.status}`}>{r.status}</span>{r.confidence && <small> {r.confidence}</small>}</td>
            <td>{r.company?.name ?? r.candidates?.map((c) => c.name).join(" / ") ?? ""}</td>
            <td>{r.company?.businessId ?? ""}</td>
            <td>{r.customer?.companyForm ?? ""}</td>
            <td>{r.customer?.addressbook?.[0]?.city ?? ""}</td>
            <td>{r.customer?.vatRegistrationNumber ?? ""}</td>
            <td className="muted">{[...r.warnings, r.error].filter(Boolean).join(", ")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
