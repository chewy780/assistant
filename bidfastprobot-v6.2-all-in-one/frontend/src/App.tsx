import React, { useEffect, useRef, useState } from "react";

type LogItem = { level: string; msg: string; ts: number };
const ADMIN_KEY = (import.meta as any).env?.VITE_ADMIN_KEY || (window as any).__ADMIN_KEY__ || "";

async function api(path: string, opts: RequestInit = {}){
  const headers = { "Content-Type":"application/json", "X-API-Key": ADMIN_KEY } as any;
  opts.headers = { ...(opts.headers || {}), ...headers };
  const r = await fetch(path, opts);
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}

function Tabs({tab,setTab}:{tab:string;setTab:(t:string)=>void}){
  const items = ["Wizard","Command Center","Memory","Audit"];
  return (<div className="flex gap-2 mb-6">{items.map(t => (<button key={t} onClick={()=>setTab(t)} className={"tab " + (tab===t ? "tab-active" : "")}>{t}</button>))}</div>);
}

function useLogs(taskId?:string|null){
  const [logs,setLogs]=useState<LogItem[]>([]); const esRef=useRef<EventSource|null>(null);
  useEffect(()=>{ if(!taskId) return; esRef.current?.close(); const es=new EventSource(`/events/agents/logs/${taskId}`);
    es.onmessage=(ev)=>{try{setLogs(p=>[...p,JSON.parse(ev.data)])}catch{}}; es.onerror=()=>{}; esRef.current=es; return()=>{esRef.current?.close()}; },[taskId]);
  return logs;
}

function CommandCenter(){
  const [status,setStatus]=useState<null|string>(null); const [text,setText]=useState(""); const [taskId,setTaskId]=useState<string|null>(null);
  const logs=useLogs(taskId);
  useEffect(()=>{fetch("/healthz").then(r=>r.json()).then(d=>setStatus(d.status ? "OK":"ERR")).catch(()=>setStatus("ERR"))},[]);
  const enqueue=async()=>{ const d=await api("/api/agents/run",{method:"POST",body:JSON.stringify({text})}); setTaskId(d.task_id); };
  const promote=async()=>{ if(!taskId) return; await api("/api/deploy/promote",{method:"POST",body:JSON.stringify({task_id:taskId})}); };
  const rollback=async()=>{ await api("/api/deploy/rollback",{method:"POST",body:JSON.stringify({})}); };
  const preview = taskId ? `/preview/${taskId}/` : "#"; const prod="/prod/"; const wildcard = taskId ? `https://${taskId}.preview.${location.host.replace(/^www\./,'')}` : "#";
  return (<div className="card space-y-4 grid2">
    <div>
      <h2 className="text-xl font-semibold">Command Center</h2>
      <input className="input mt-2" placeholder="Describe what to build…" value={text} onChange={e=>setText(e.target.value)} />
      <div className="flex flex-wrap gap-3 items-center mt-3">
        <button className="btn btn-primary" onClick={enqueue}>Run</button>
        <div className="badge">API: {status??"…"}</div>
        {taskId&&<span className="badge">Task: {taskId.slice(0,8)}…</span>}
        {taskId&&<a className="link" href={preview} target="_blank" rel="noreferrer">Open preview</a>}
        {taskId&&<a className="link" href={wildcard} target="_blank" rel="noreferrer">Wildcard URL</a>}
        <a className="link" href={prod} target="_blank" rel="noreferrer">Open production</a>
        {taskId&&<button className="btn" onClick={promote}>Promote</button>}
        <button className="btn" onClick={rollback}>Rollback</button>
      </div>
      <div className="mt-4">
        <h3 className="font-semibold mb-2">Live Logs</h3>
        <div className="bg-black/40 rounded-xl p-3 h-64 overflow-auto">
          {logs.map((l,i)=>(<div key={i} className="log"><span className="opacity-60 mr-2">{new Date(l.ts*1000).toLocaleTimeString()}</span><span className={l.level==="error"?"text-red-400":l.level==="success"?"text-green-400":"text-white"}>{l.msg}</span></div>))}
          {!logs.length&&<div className="opacity-60">No logs yet…</div>}
        </div>
      </div>
    </div>
    <div className="preview">
      {taskId ? <iframe src={preview} /> : <div className="p-6 opacity-70">Run a task to see the live preview here.</div>}
    </div>
  </div>);
}

function Wizard(){
  const [text,setText]=useState("Build a Vite+React landing page with a neon hero and email capture.");
  const [taskId,setTaskId]=useState<string|null>(null);
  const logs=useLogs(taskId);
  const run=async()=>{ const d=await api("/api/agents/run",{method:"POST",body:JSON.stringify({text})}); setTaskId(d.task_id); };
  const promote=async()=>{ if(!taskId) return; await api("/api/deploy/promote",{method:"POST",body:JSON.stringify({task_id:taskId})}); };
  const rollback=async()=>{ await api("/api/deploy/rollback",{method:"POST",body:JSON.stringify({})}); };
  const artifact = taskId ? `/api/artifact/${taskId}.zip` : "#"; const preview = taskId ? `/preview/${taskId}/` : "#"; const wildcard = taskId ? `https://${taskId}.preview.${location.host.replace(/^www\./,'')}` : "#"; const prod = "/prod/";
  return (<div className="card">
    <h2 className="text-xl font-semibold mb-4">Build Wizard</h2>
    <textarea className="input" rows={4} value={text} onChange={e=>setText(e.target.value)} />
    <div className="flex flex-wrap gap-4 items-center mt-3">
      <button className="btn btn-primary" onClick={run}>Build</button>
      {taskId&&<a className="link" href={artifact} target="_blank" rel="noreferrer">Download build (zip)</a>}
      {taskId&&<a className="link" href={preview} target="_blank" rel="noreferrer">Open preview</a>}
      {taskId&&<a className="link" href={wildcard} target="_blank" rel="noreferrer">Wildcard URL</a>}
      <a className="link" href={prod} target="_blank" rel="noreferrer">Open production</a>
      {taskId&&<button className="btn" onClick={promote}>Promote</button>}
      <button className="btn" onClick={rollback}>Rollback</button>
    </div>
    <div className="bg-black/40 rounded-xl p-3 h-64 overflow-auto mt-4">
      {logs.map((l,i)=>(<div key={i} className="log"><span className="opacity-60 mr-2">{new Date(l.ts*1000).toLocaleTimeString()}</span><span className={l.level==="error"?"text-red-400":l.level==="success"?"text-green-400":"text-white"}>{l.msg}</span></div>))}
      {!logs.length&&<div className="opacity-60">Waiting for logs…</div>}
    </div>
  </div>);
}

function MemoryTab(){
  const [scope,setScope]=useState("project");
  const [key,setKey]=useState("default");
  const [note,setNote]=useState(""); const [query,setQuery]=useState("");
  const [results,setResults]=useState<any[]>([]);
  const upsert=async()=>{ if(!note) return; await api("/api/sememory/upsert",{method:"POST",body:JSON.stringify({scope,key,note})}); setNote(""); };
  const search=async()=>{ const d=await api(`/api/sememory/search?scope=${scope}&key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}&topk=5`); setResults(d); };
  return (<div className="card space-y-3">
    <h2 className="text-xl font-semibold">Semantic Memory</h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <select className="input" value={scope} onChange={e=>setScope(e.target.value)}>
        <option value="user">user</option><option value="project">project</option><option value="agent">agent</option>
      </select>
      <input className="input" placeholder="Key (e.g., user or project id)" value={key} onChange={e=>setKey(e.target.value)} />
      <div className="flex gap-2">
        <input className="input" placeholder="Semantic search query…" value={query} onChange={e=>setQuery(e.target.value)} />
        <button className="btn btn-primary" onClick={search}>Search</button>
      </div>
    </div>
    <div className="flex gap-2">
      <input className="input" placeholder="Add a memory note…" value={note} onChange={e=>setNote(e.target.value)} />
      <button className="btn btn-primary" onClick={upsert}>Remember</button>
    </div>
    <div className="bg-black/30 rounded-xl p-3 h-64 overflow-auto">
      <div className="font-semibold mb-1">Semantic results</div>
      {results.map((r,i)=>(<div key={i} className="log">{r.note} <span className="opacity-60">(score { (r.score?.toFixed ? r.score.toFixed(2) : r.score) ?? "" })</span></div>))}
      {!results.length && <div className="opacity-60">No results.</div>}
    </div>
  </div>);
}

function Audit(){
  const [events,setEvents]=useState<any[]>([]);
  const reload=async()=>{ const d=await api("/api/deploy/audit"); setEvents(d.events.map((e:string)=>JSON.parse(e))); };
  useEffect(()=>{ reload(); },[]);
  const ensureDns=async()=>{ await api("/api/admin/ensure-dns",{method:"POST",body:JSON.stringify({})}); alert("DNS ensure queued"); };
  return (<div className="card"><h2 className="text-xl font-semibold mb-3">Audit Log</h2>
    <div className="bg-black/30 rounded-xl p-3 h-64 overflow-auto">
      {events.map((e,i)=>(<div key={i} className="log">{new Date(e.ts*1000).toLocaleString()} — <span className="text-white/80">{e.action}</span> {e.task_id||e.version||""} <span className="text-white/50">({e.ip})</span></div>))}
      {!events.length && <div className="opacity-60">No events yet.</div>}
    </div>
    <div className="mt-3"><button className="btn" onClick={ensureDns}>Ensure wildcard DNS now</button></div>
  </div>);
}

export default function App(){ const [tab,setTab]=useState("Wizard"); return(<div className="min-h-full p-6 md:p-10"><div className="flex items-center justify-between mb-6"><h1 className="text-2xl md:text-3xl font-bold">🚀 BidFast ProBot — AI Engineer</h1></div><Tabs tab={tab} setTab={setTab}/>{tab==="Wizard"&&<Wizard/>}{tab==="Command Center"&&<CommandCenter/>}{tab==="Memory"&&<MemoryTab/>}{tab==="Audit"&&<Audit/>}</div>) }
