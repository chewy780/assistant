# CI/CD with GitHub Actions

This repo includes a workflow that:
1. Runs on push to `main` (and manual dispatch)
2. Builds the frontend assets
3. Rsyncs the repo to your server (over SSH)
4. Executes `scripts/deploy.sh` on the server to `docker compose up -d --build`

## Required GitHub Secrets (Settings → Secrets and variables → Actions)
- `SSH_HOST` — server IP or DNS (e.g., 203.0.113.10)
- `SSH_USER` — SSH user (e.g., ubuntu)
- `SSH_PRIVATE_KEY` — private key for the above user
- `DEPLOY_PATH` — absolute path on the server (e.g., /opt/bidfastprobot)

(Optionally)
- `SSH_PORT` — set if not 22

> Place your production `.env` manually on the server at `$DEPLOY_PATH/.env` and **do not** commit it.

## First deploy
```bash
# On the server, once:
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin rsync
sudo usermod -aG docker $USER  # re-login if needed

mkdir -p /opt/bidfastprobot
# copy your .env there and fill secrets (OPENAI_API_KEY, etc.)
```

## Rollback
Use the UI "Rollback" button or on the server:
```bash
docker compose logs -n 200 worker
# rollback is triggered through the app; images are kept in Redis history
```
