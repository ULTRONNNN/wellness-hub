import { useEffect, useState } from 'react';
import { FileText, ShieldCheck, Brain, Trash2, History, LockKeyhole, PlusCircle, RefreshCw, Search, AlertCircle, CheckCircle } from 'lucide-react';
import { apiCall } from './api';
import './ReportsPage.css';

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [consent, setConsent] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  async function load() {
    setLoading(true);
    try {
      const data = await apiCall('/reports');
      setReports(Array.isArray(data) ? data : []);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  async function run(key, action, success) {
    if (busy || loading) return;
    setBusy(key); setError(''); setNotice('');
    try { await action(); setNotice(success); await load(); }
    catch(e) { setError(e.message); }
    finally { setBusy(''); }
  }
  const addDemo = () => run('demo', () => apiCall('/reports/demo', {method:'POST', body:{}}), 'Demo reports created.');
  function analyze(id) {
    if (!consent) { setError('Please provide AI processing consent.'); return; }
    return run(`analyze-${id}`, async () => {
      await apiCall(`/reports/${id}/analyze`, {method:'POST', body:{consent:true}});
      setConsent(false);
    }, 'Report analysis completed.');
  }
  function remove(id) {
    if (!window.confirm('Permanently delete this report?')) return;
    return run(`delete-${id}`, () => apiCall(`/reports/${id}`, {method:'DELETE'}), 'Report deleted.');
  }
  const analyzed = item => Boolean(item.analysis || item.status === 'analyzed');
  const visible = reports.filter(item => {
    const text = `${item.reportType || ''} ${item.report?.filename || ''} ${item.reportDate || ''}`.toLowerCase();
    return text.includes(query.toLowerCase().trim()) && (filter === 'all' || (filter === 'analyzed' ? analyzed(item) : !analyzed(item)));
  });
  const disabled = Boolean(busy || loading);
  return <div className="reports-page wh-records">
    <div className="wh-records-heading"><div><span className="wh-eyebrow">YOUR HEALTH WORKSPACE</span><h1>Medical Reports</h1><p>Manage your records and explore AI-assisted insights.</p></div><button type="button" className="wh-secondary" disabled={disabled} onClick={() => {setError(''); load();}}><RefreshCw size={17}/> Refresh</button></div>
    <section className="wh-records-hero"><div><span className="wh-hero-label"><ShieldCheck size={16}/> EDUCATIONAL PROTOTYPE</span><h2>Your health records.<br/>All in one place.</h2><p>Encrypted report storage, local AI analysis and historical report comparison.</p></div><div className="wh-hero-icon"><FileText size={76} strokeWidth={1.3}/></div></section>
    <div className="wh-metrics">{[[FileText,'Total reports',reports.length],[Brain,'Analyzed reports',reports.filter(analyzed).length],[History,'Awaiting analysis',reports.filter(i=>!analyzed(i)).length]].map(([Icon,label,value])=><div className="wh-metric" key={label}><span className="wh-icon"><Icon size={23}/></span><div><small>{label}</small><strong>{loading?'—':value}</strong></div></div>)}</div>
    <div className="wh-security">{[[LockKeyhole,'AES-256-GCM','Encrypted storage'],[ShieldCheck,'Private access','Patient authorization'],[Brain,'Local AI','Consent required']].map(([Icon,title,subtitle])=><div key={title}><Icon size={20}/><span><strong>{title}</strong><small>{subtitle}</small></span></div>)}</div>
    <section className="wh-demo"><span className="wh-icon"><PlusCircle size={27}/></span><div><h2>Explore the report assistant</h2><p>Generate fictional blood test records, or attach a fictional PDF or readable image using the paperclip in CareBot. Maximum upload size: 5 MB.</p></div><button type="button" className="wh-primary" disabled={disabled} onClick={addDemo}><PlusCircle size={18}/>{busy==='demo'?'Generating…':'Generate demo reports'}</button></section>
    <label className="wh-consent"><input type="checkbox" checked={consent} disabled={disabled} onChange={e=>setConsent(e.target.checked)}/><span><strong>AI processing consent</strong><small>I consent to local AI analysis of fictional medical report data.</small></span></label>
    {error && <div className="wh-alert" role="alert"><AlertCircle size={19}/>{error}</div>}
    {notice && <div className="wh-success" role="status"><CheckCircle size={19}/>{notice}</div>}
    {busy && <div className="wh-progress" role="status"><span className="wh-spinner"/>Processing your request…</div>}
    <div className="wh-history-heading"><h2><History size={23}/> Report history</h2><span>{visible.length} records</span></div>
    <div className="wh-toolbar"><label className="wh-search"><Search size={18}/><input placeholder="Search reports…" aria-label="Search reports" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Filter reports" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All reports</option><option value="analyzed">Analyzed</option><option value="pending">Awaiting analysis</option></select></div>
    {loading ? <div className="wh-empty" role="status"><span className="wh-spinner"/> Loading reports…</div> : visible.length===0 ? <div className="wh-empty"><FileText size={42}/><h3>{reports.length?'No matching reports':'No medical reports yet'}</h3><p>{reports.length?'Try another search or filter.':'Generate demo reports or attach a report in CareBot.'}</p></div> : <div className="wh-record-grid">{visible.map(item=>{
      const values = [['Hemoglobin',item.report?.hemoglobin],['Glucose',item.report?.glucose]].filter(([,v])=>v!=null && ['string','number'].includes(typeof v));
      const date = new Date(item.reportDate);
      return <article className="wh-record" key={item._id}><div className="wh-record-header"><span className="wh-icon"><FileText size={24}/></span><div><h3>{item.reportType || 'Medical report'}</h3><small>{item.reportDate && !Number.isNaN(date.getTime())?date.toLocaleDateString('en-IN'):'Date unavailable'}</small></div><span className="wh-tag"><LockKeyhole size={13}/> Encrypted</span></div>
      <div className="wh-record-status">{analyzed(item)?'Analysis completed':'Awaiting analysis'}</div>
      {item.report?.filename && <p className="wh-filename">{item.report.filename}</p>}
      {values.length>0 && <div className="wh-values">{values.map(([label,value])=><div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>}
      <div className="wh-actions"><button type="button" className="wh-primary" disabled={disabled || !consent} onClick={()=>analyze(item._id)}><Brain size={18}/>{busy===`analyze-${item._id}`?'Analyzing…':analyzed(item)?'Analyze again':'Analyze with AI'}</button><button type="button" className="wh-delete" title="Delete report" aria-label="Delete report" disabled={disabled} onClick={()=>remove(item._id)}><Trash2 size={19}/></button></div>
      {item.analysis && <details className="wh-analysis"><summary><Brain size={19}/> AI health analysis</summary><p>{typeof item.analysis==='string'?item.analysis:JSON.stringify(item.analysis,null,2)}</p></details>}
      </article>;
    })}</div>}
    <div className="wh-safety"><AlertCircle size={20}/><span>Use fictional reports only. AI and OCR results require medical verification and do not replace professional medical advice.</span></div>
  </div>;
}
