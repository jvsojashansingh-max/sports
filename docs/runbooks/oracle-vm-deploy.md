# Oracle + Vercel Deploy Checklist (Simple)

This is the full list, including every signup/login action.

## Accounts and logins

1. Sign up/login to GitHub.
2. Sign up/login to Oracle Cloud.
3. Sign up/login to Vercel.
4. Sign up/login to Neon.
5. Sign up/login to Upstash.
6. Sign up/login to Google Cloud Console (only if you want real Google OAuth now).

## External resources

1. GitHub: create a new repository for this project.
2. Neon: create a production Postgres project and copy `DATABASE_URL`.
3. Upstash: create a Redis database and copy `REDIS_URL`.
4. Oracle Cloud: create one Ubuntu VM in Mumbai or Hyderabad.
5. Oracle Cloud: open inbound ports `22`, `80`, and `443` in VCN security rules.
6. DNS provider: create an `A` record for `api.yourdomain.com` to Oracle VM public IP.

## Local machine (one time)

1. In `/Users/jvsingh/Desktop/sports`, initialize git and push:
   - `git init`
   - `git add .`
   - `git commit -m "Initial commit"`
   - `git branch -M main`
   - `git remote add origin <your-repo-url>`
   - `git push -u origin main`
2. Copy `.env.production.example` to `.env.production` and fill real values.
3. Keep OTP launch mode as `OTP_PROVIDER=stub` for demo.
4. Keep `NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com`.

## Oracle VM setup

1. SSH into VM.
2. Run bootstrap script:
   - `bash infra/scripts/oracle/bootstrap-vm.sh`
3. Re-login to apply docker group.
4. Pull and deploy:
   - `chmod +x infra/scripts/oracle/deploy.sh`
   - `REPO_URL=<your-repo-url> BRANCH=main bash infra/scripts/oracle/deploy.sh`

## Vercel setup

1. Import GitHub repo in Vercel.
2. Set root directory to `apps/web`.
3. Add env var:
   - `NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com`
4. Deploy.

## API env vars required on Oracle

1. `NODE_ENV=production`
2. `PORT=4000`
3. `CORS_ORIGIN=https://<your-vercel-domain>.vercel.app`
4. `DATABASE_URL=<from-neon>`
5. `REDIS_URL=<from-upstash>`
6. `JWT_ACCESS_SECRET=<strong-random-value>`
7. `JWT_REFRESH_SECRET=<strong-random-value>`
8. `OTP_PROVIDER=stub`
9. `API_DOMAIN=api.yourdomain.com`
10. `GOOGLE_CLIENT_ID=<optional now>`
11. `GOOGLE_CLIENT_SECRET=<optional now>`
12. `GOOGLE_REDIRECT_URI=https://api.yourdomain.com/api/auth/google/callback`

## Verify after deploy

1. Check API health: `https://api.yourdomain.com/api/healthz`.
2. Open web app on Vercel and test OTP sign-in.
3. Send a chat message and confirm realtime delivery.
4. Check worker logs:
   - `docker compose -f infra/docker/docker-compose.oracle.yml logs -f worker`
