import os, psycopg2, openai, subprocess, json, tempfile, shutil, uuid

def db_conn():
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST","db"),
        port=int(os.getenv("POSTGRES_PORT","5432")),
        user=os.getenv("POSTGRES_USER","app"),
        password=os.getenv("POSTGRES_PASSWORD","app_pw"),
        dbname=os.getenv("POSTGRES_DB","bidfast"),
    )

def fetch_memories(scope, key, query, topk=5):
    emb = embed_text(query)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT note FROM memories WHERE scope=%s ORDER BY embedding <-> %s LIMIT %s", (scope, emb, topk))
            return [r[0] for r in cur.fetchall()]

def embed_text(text: str):
    openai.api_key = os.getenv("OPENAI_API_KEY")
    model = os.getenv("OPENAI_EMBEDDINGS_MODEL","text-embedding-3-large")
    resp = openai.embeddings.create(input=[text], model=model)
    return resp.data[0].embedding

def run_codegen_task(prompt: str, runtime="python"):
    openai.api_key = os.getenv("OPENAI_API_KEY")
    memories = fetch_memories("project", "default", prompt, int(os.getenv("SEMANTIC_TOPK","5")))
    if memories:
        mem_block = "\n".join(f"- {m}" for m in memories)
        prompt = f"Use the following relevant context when generating code:\n{mem_block}\n\nTASK:\n{prompt}"
    model = os.getenv("DEFAULT_MODEL","gpt-5")
    resp = openai.chat.completions.create(
        model=model,
        messages=[{"role":"system","content":"You are an autonomous AI engineer."},{"role":"user","content":prompt}],
        max_tokens=int(os.getenv("MAX_TOKENS","1024"))
    )
    code = resp.choices[0].message["content"]
    return code

def deploy_service(code: str, runtime="python"):
    # Save code to temp dir
    tid = str(uuid.uuid4())[:8]
    workdir = f"/tmp/task_{tid}"
    os.makedirs(workdir, exist_ok=True)
    file_path = os.path.join(workdir, "main.py" if runtime=="python" else "index.js")
    with open(file_path,"w") as f:
        f.write(code)
    # Simulate docker build + direct compose service swap
    print(f"[deploy] Building {runtime} service from {file_path} ...")
    # In production, run: docker compose build <svc> && docker compose up -d <svc>
    return {"task_id": tid, "runtime": runtime, "status": "deployed", "path": workdir}
