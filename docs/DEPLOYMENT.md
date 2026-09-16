# CHESS PLAYER ANALYZER V2: DEPLOYMENT GUIDE (100% FREE TIER)

This guide walks you through deploying **Chess Player Analyzer V2** to **Vercel** and **Supabase** within their permanent Free Tier quotas ($0/month).

---

## 1. Prerequisites (All Free)
1. **GitHub Account**: To host the repository.
2. **Vercel Account**: Hobby tier (Free serverless hosting + Python runtime).
3. **Supabase Account**: Free plan (500MB PostgreSQL database + Auth + 1GB Storage).
4. **Google AI Studio Key** (Optional): Free tier Gemini API key for AI coaching.

---

## 2. Step 1: Supabase Database & Storage Setup

1. Log in to [supabase.com](https://supabase.com) and create a **New Project**.
2. Open the **SQL Editor** from the left navigation.
3. Paste the contents of [`supabase/migrations/20260916000001_initial_schema.sql`](../supabase/migrations/20260916000001_initial_schema.sql) and click **Run**.
   - This creates all 8 tables, indexes, triggers, and Row Level Security (RLS) policies.
4. *(Optional for testing)* Paste and run [`supabase/seed.sql`](../supabase/seed.sql) to populate sample test players and games.
5. Go to **Storage** > **New Bucket**:
   - Bucket name: `pgn-vault`
   - Public bucket: Yes (or configure private bucket policy)
6. Go to **Project Settings** > **API**:
   - Copy **Project URL** (`https://<project-ref>.supabase.co`).
   - Copy **Project API Key (anon / public)**.
   - Copy **Project API Key (service_role / secret)**.

---

## 3. Step 2: Vercel Deployment

1. Push this repository to your GitHub account.
2. Log in to [vercel.com](https://vercel.com) and click **Add New...** > **Project**.
3. Select your `chess-player-analyzer-v2` repository.
4. In the **Configure Project** screen:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `./`
5. Expand **Environment Variables** and add the following:

| Variable Name | Value | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhb...` | Supabase Anonymous Public Key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhb...` | Supabase Service Role Secret |
| `GEMINI_API_KEY` | `AIzaSy...` | Google AI Studio Key (or leave blank for Local Expert mode) |

6. Click **Deploy**.
7. Vercel automatically:
   - Installs Node.js dependencies and compiles the Next.js App Router frontend.
   - Packages `api/index.py` and `src/` into the Vercel Python Serverless Runtime.
   - Mounts `/api/*` endpoints directly to FastAPI.

---

## 4. Step 3: Post-Deployment Verification

1. Navigate to your production URL: `https://<your-project>.vercel.app`.
2. Check the API health endpoint: `https://<your-project>.vercel.app/api/health`.
   - Expected response: `{"success": true, "data": {"status": "healthy", "version": "2.0.0"}}`.
3. Open `/import`, upload a sample `.pgn` file or enter a Lichess username, and verify that games are imported and analyzed.
4. Open `/analyze` to verify that Stockfish WASM initializes in the browser Web Worker and delivers live evaluation bars.
