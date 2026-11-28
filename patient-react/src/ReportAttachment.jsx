import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import "./ReportAttachment.css";

import {
  Paperclip,
  X,
  FileText,
  Send,
  ShieldCheck,
  Image as ImageIcon
} from "lucide-react";

import { getToken, apiCall } from "./api";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const SUPPORTED_FILES = /\.(pdf|jpg|jpeg|png)$/i;

export default function ReportAttachment() {

  const fileRef = useRef(null);
  const endRef = useRef(null);
  const requestLock = useRef(false);
  const [phase, setPhase] = useState("");

  const [file, setFile] = useState(null);
  const [date, setDate] = useState("");
  const [needsDate, setNeedsDate] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reportId, setReportId] = useState("");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [ocrConfidence, setOcrConfidence] = useState(null);
  const [reportDate, setReportDate] = useState("");
  const [extractionMethod, setExtractionMethod] = useState("");

  useEffect(() => {
    if (messages.length || busy || error) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, busy, error]);

  const isImage =
    file && /\.(jpg|jpeg|png)$/i.test(file.name);

  // Reset report state
  function resetReport() {

    setReportId("");
    setMessages([]);
    setError("");
    setConsent(false);
    setDate("");
    setNeedsDate(false);
    setQuestion("");
    setOcrConfidence(null);
    setReportDate("");
    setExtractionMethod("");
  }

  // Select PDF or image
  function selectFile(e) {

    const selected = e.target.files?.[0];

    if (!selected) return;

    resetReport();
    setFile(selected);

    if (!SUPPORTED_FILES.test(selected.name)) {

      setError(
        "Only PDF, JPG, JPEG and PNG files are supported."
      );

      return;
    }

    if (selected.size > MAX_FILE_SIZE) {

      setError("File size must not exceed 5 MB.");

      return;
    }

    if (selected.size === 0) {

      setError("The selected file is empty.");
    }
  }

  const validFile =
    file &&
    SUPPORTED_FILES.test(file.name) &&
    file.size > 0 &&
    file.size <= MAX_FILE_SIZE;

  // Upload and analyze report
  async function uploadReport() {

    if (
      !validFile ||
      !consent ||
      busy || requestLock.current ||
      (needsDate && !date)
    ) return;

    requestLock.current = true;
    setBusy(true);
    setPhase(reportId ? "Analyzing report locally…" : "Uploading and extracting report text…");
    setError("");

    try {

      let id = reportId;

      if (!id) {

        const form = new FormData();

        form.append("report", file);

        if (needsDate && date) {
          form.append("reportDate", date);
        }

        const response = await fetch(
          "http://127.0.0.1:4000/api/reports/upload",
          {
            method: "POST",

            headers: {
              Authorization: `Bearer ${getToken()}`
            },

            body: form
          }
        );

        const data = await response.json().catch(() => ({}));

        // Manual date fallback
        if (data.code === "DATE_REQUIRED") {

          setNeedsDate(true);

          throw new Error(
            "Please confirm the report date."
          );
        }

        if (!response.ok) {

          throw new Error(
            data.error || "Upload failed"
          );
        }

        id = data.reportId;

        if (!id) {
          throw new Error("Report ID was not returned.");
        }

        setReportId(id);
        setNeedsDate(false);

        setReportDate(
          data.reportDate
            ? data.reportDate.slice(0, 10)
            : ""
        );

        setExtractionMethod(
          data.extractionMethod || ""
        );

        setOcrConfidence(
          Number.isFinite(data.ocrConfidence)
            ? data.ocrConfidence
            : null
        );
      }

      setPhase("Analyzing report with local AI… This may take a few minutes.");
      // Analyze using local AI
      const data = await apiCall(
        `/reports/${id}/analyze`,
        {
          method: "POST",

          body: {
            consent: true
          }
        }
      );

      if (typeof data.analysis !== "string" || !data.analysis.trim()) throw new Error("No analysis returned. Please retry.");
      setMessages([
        {
          role: "assistant",
          content: data.analysis
        }
      ]);

    } catch (err) {

      setError(
        err.message === "Failed to fetch"
          ? "Cannot connect to backend. Ensure the server is running on port 4000."
          : err.message
      );

    } finally {

      requestLock.current = false;
      setPhase("");
      setBusy(false);
    }
  }

  // Ask follow-up questions
  async function askQuestion(prompt = question) {

    const value = prompt.trim();

    if (
      !value ||
      !reportId ||
      !consent ||
      busy || requestLock.current || value.length > 1000
    ) return;

    requestLock.current = true;
    setBusy(true);
    setPhase("CareBot is reviewing your report and recent conversation…");
    setError("");
    setQuestion("");

    setMessages(old => [
      ...old,
      {
        role: "user",
        content: value
      }
    ]);

    try {

      const data = await apiCall(
        `/reports/${reportId}/ask`,
        {
          method: "POST",

          body: {
            question: value,
            consent: true
          }
        }
      );

      if (typeof data.answer !== "string" || !data.answer.trim()) throw new Error("No answer returned. Please retry.");
      setMessages(old => [
        ...old,
        {
          role: "assistant",
          content: data.answer
        }
      ]);

    } catch (err) {

      setError(err.message);
      setQuestion(value);
      setMessages(old => old.slice(0, -1));

    } finally {

      requestLock.current = false;
      setPhase("");
      setBusy(false);
    }
  }

  // Close report assistant
  function closeReport() {

    if (busy || requestLock.current) return;

    setFile(null);
    resetReport();

    if (fileRef.current) {
      fileRef.current.value = "";
    }
  }

  function chooseFile() {

    if (busy || requestLock.current || !fileRef.current) return;

    fileRef.current.value = "";
    fileRef.current.click();
  }

  return (
    <>
      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" hidden disabled={busy} onChange={selectFile} />
      <button type="button" className="ra-attach" title="Attach medical report" aria-label="Attach medical report" disabled={busy} onClick={chooseFile}><Paperclip size={22}/></button>
      {file && createPortal(
        <div className="ra-overlay">
          <section className="ra-dialog" role="dialog" aria-modal="true" aria-labelledby="ra-title">
            <header className="ra-header">
              <div className="ra-heading"><span className="ra-logo"><ShieldCheck size={28}/></span><div><small>WELLNESS HUB / CAREBOT</small><h2 id="ra-title">Medical report assistant</h2><p>Understand your reports with local AI</p></div></div>
              <button type="button" className="ra-close" aria-label="Close report assistant" disabled={busy} onClick={closeReport}><X size={22}/></button>
            </header>
            <div className="ra-body">
              <div className="ra-steps"><span className="ra-current">01 · Select report</span><span className={reportId ? "ra-current" : ""}>02 · Extract text</span><span className={messages.length ? "ra-current" : ""}>03 · AI insights</span></div>
              <div className="ra-file"><span className="ra-file-icon">{isImage ? <ImageIcon size={28}/> : <FileText size={28}/>}</span><div className="ra-file-info"><strong>{file.name}</strong><p>{(file.size / 1024).toFixed(1)} KB · {isImage ? "Image / Tesseract OCR" : "PDF / Text extraction"}</p><small>{reportDate ? `Report date: ${reportDate}` : "Report date detected automatically when possible"}</small></div><button type="button" className="ra-secondary" disabled={busy} onClick={chooseFile}>Change file</button></div>
              {extractionMethod && <p className="ra-meta">Extraction method: {extractionMethod}</p>}
              {ocrConfidence !== null && <div className="ra-info"><strong>OCR confidence: {ocrConfidence.toFixed(1)}%</strong><progress max={100} value={Math.max(0, Math.min(100, ocrConfidence))}/><small>Confidence does not guarantee medical accuracy. Verify extracted values.</small></div>}
              <div className="ra-info"><strong>Supported medical reports</strong><p>Blood tests, thyroid, cholesterol, liver and kidney function reports with readable text.</p><div className="ra-tags">{["PDF","JPG","JPEG","PNG"].map(t => <span key={t}>{t}</span>)}</div><small>Up to 5 MB · First 15 PDF pages processed</small></div>
              {isImage && <div className="ra-info"><strong>Image text extraction</strong><p>Use a clear image with visible text. OCR does not interpret diagnostic scans.</p></div>}
              {needsDate && <label className="ra-warning">Confirm report date<input type="date" value={date} disabled={busy || !!reportId} onChange={e => setDate(e.target.value)}/></label>}
              <div className="ra-security"><ShieldCheck size={21}/><span>Local AI · Encrypted report storage</span></div>
              <div className="ra-warning">Educational prototype. Upload trusted fictional reports only. AI and OCR interpretations require medical verification.</div>
              <label className="ra-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)}/> I consent to local AI report analysis.</label>
              {!messages.length && <button type="button" className="ra-primary ra-full" disabled={!validFile || !consent || busy || (needsDate && !date)} onClick={uploadReport}>{busy ? "Processing report…" : reportId ? "Retry AI analysis" : "Upload and analyze report"}</button>}
              {messages.length > 0 && <h3 className="ra-result-title">Report conversation</h3>}
              {messages.map((m,i) => <article key={i} className={`ra-message ${m.role === "user" ? "ra-user" : "ra-ai"}`}><strong>{m.role === "user" ? "You" : "CareBot AI"}</strong><p style={{whiteSpace: "pre-wrap", overflowWrap: "anywhere"}}>{m.content}</p></article>)}
              {busy && <div className="ra-loading" role="status"><span className="ra-spinner"/>{phase || "Processing your request locally…"}</div>}
              {error && <div className="ra-error" role="alert">{error}</div>}
              {reportId && messages.length > 0 && <div className="ra-prompts">{["What should I do next?","Which values are abnormal?","What questions should I ask my doctor?","Which doctor should I consult?","Explain my report simply"].map(q => <button type="button" key={q} disabled={busy || !consent} onClick={() => askQuestion(q)}>{q}</button>)}</div>}
              <div ref={endRef} aria-hidden="true"/>
            </div>
            {reportId && messages.length > 0 && <form className="ra-composer" onSubmit={e => {e.preventDefault(); e.stopPropagation(); askQuestion();}}><input aria-label="Follow-up question" value={question} maxLength={1000} disabled={busy || !consent} placeholder="Ask about your medical report…" onChange={e => setQuestion(e.target.value)}/><button className="ra-primary" type="submit" aria-label="Send question" disabled={busy || !consent || !question.trim()}><Send size={20}/></button></form>}
          </section>
        </div>, document.body
      )}
    </>
  );
}