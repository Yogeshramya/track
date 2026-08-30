# LocShare Frontend (Next.js)

Next.js 14 Web Application for real-time location sharing and telemetry visualization.

## Local Setup

1. `cd frontend`
2. `npm install`
3. `npm run dev` (starts on port `3000`)

## Deploying to Vercel

1. Push this repository to GitHub.
2. Go to [Vercel Dashboard](https://vercel.com/new) and import your repository.
3. In the project setup settings:
   - **Root Directory:** Select `frontend`
   - **Framework Preset:** Next.js (automatically detected)
4. Add Environment Variable:
   - **Name:** `NEXT_PUBLIC_SOCKET_URL`
   - **Value:** `https://your-backend-service.onrender.com` (Your deployed Render/Railway backend URL)
5. Click **Deploy**! 🚀
