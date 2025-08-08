from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os, psycopg2, json
from typing import List
import openai

app = FastAPI(title="BidFast Backend", version="0.1")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DB connect
def db_conn():
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST","db"),
        port=int(os.getenv("POSTGRES_PORT","5432")),
        user=os.getenv("POSTGRES_USER","app"),
        password=os.getenv("POSTGRES_PASSWORD","app_pw"),
        dbname=os.getenv("POSTGRES_DB","bidfast"),
    )

# Memory model
class MemoryItem(BaseModel):
    scope: str
    key: str
    note: str

@app.post("/api/sememory/upsert")
def upsert_memory(mem: MemoryItem):
    emb = embed_text(mem.note)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO memories(scope,key,note,embedding) VALUES (%s,%s,%s,%s)", (mem.scope, mem.key, mem.note, emb))
    return {"status":"ok"}

class SearchQuery(BaseModel):
    scope: str
    query: str

@app.post("/api/sememory/search")
def search_memory(q: SearchQuery):
    emb = embed_text(q.query)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT scope,key,note FROM memories WHERE scope=%s ORDER BY embedding <-> %s LIMIT %s", (q.scope, emb, int(os.getenv("SEMANTIC_TOPK","5"))))
            rows = cur.fetchall()
    return [{"scope":r[0],"key":r[1],"note":r[2]} for r in rows]

def embed_text(text: str):
    openai.api_key = os.getenv("OPENAI_API_KEY")
    model = os.getenv("OPENAI_EMBEDDINGS_MODEL","text-embedding-3-large")
    resp = openai.embeddings.create(input=[text], model=model)
    vec = resp.data[0].embedding
    return vec

@app.get("/healthz")
def health():
    return {"status":"ok"}

# --- Agent run placeholder
class AgentRunRequest(BaseModel):
    prompt: str
    max_tokens: int = 512

@app.post("/api/agent/run")
def run_agent(req: AgentRunRequest):
    openai.api_key = os.getenv("OPENAI_API_KEY")
    model = os.getenv("DEFAULT_MODEL","gpt-5")
    resp = openai.chat.completions.create(
        model=model,
        messages=[{"role":"system","content":"You are an autonomous AI engineer."},{"role":"user","content":req.prompt}],
        max_tokens=req.max_tokens
    )
    return {"output":resp.choices[0].message["content"]}
