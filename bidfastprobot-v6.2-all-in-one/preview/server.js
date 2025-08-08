import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import Redis from "ioredis";
const PORT=parseInt(process.env.PREVIEW_GATEWAY_PORT||"7300",10);
const REDIS_URL=process.env.REDIS_URL||"redis://redis:6379/0";
const redis=new Redis(REDIS_URL,{lazyConnect:true}); await redis.connect();
const app=express();
async function resolvePreviewByTask(task){ const raw=await redis.hget("preview_map", task); if(!raw) return null; const m=JSON.parse(raw); return `http://${m.host}:${m.port}`; }
async function resolveProd(){ const raw=await redis.get("prod_map"); if(!raw) return null; const m=JSON.parse(raw); return `http://${m.host}:${m.port}`; }
app.use("/preview/:task/*", async (req,res,next)=>{ const t=req.params.task, target=await resolvePreviewByTask(t); if(!target) return res.status(404).send("Preview not found"); const sub=req.originalUrl.replace(`/preview/${t}`,"")||"/"; return createProxyMiddleware({target, changeOrigin:true, pathRewrite:()=>sub, ws:true})(req,res,next); });
app.use("/prod/*", async (req,res,next)=>{ const target=await resolveProd(); if(!target) return res.status(404).send("Production not set"); const sub=req.originalUrl.replace(`/prod`,"")||"/"; return createProxyMiddleware({target, changeOrigin:true, pathRewrite:()=>sub, ws:true})(req,res,next); });
app.use(async (req,res,next)=>{ const host=req.headers.host||""; const m=host.match(/^([^.]+)\.preview\./i); if(!m) return next(); const target=await resolvePreviewByTask(m[1]); if(!target) return res.status(404).send("Preview not found"); return createProxyMiddleware({target, changeOrigin:true, ws:true})(req,res,next); });
app.listen(PORT, ()=>console.log(`[preview] gateway listening on ${PORT}`));
