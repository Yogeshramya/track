# LocShare Backend Service

Standalone Express + Socket.IO + MongoDB telemetry backend.

## Local Setup

1. `cd backend`
2. `npm install`
3. `npm run dev` (starts on port `5000`)

## Deploying to Render.com

1. Create a new **Web Service** on [Render.com](https://render.com).
2. Connect your repository.
3. Configure settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Add Environment Variables:
   - `MONGODB_URI`: `mongodb+srv://admin:Yogesh%400405@cluster0.wkrw3fv.mongodb.net/track`
   - `PORT`: `5000` (Render will set this automatically)
   - `FRONTEND_URL`: Your Vercel frontend URL (e.g. `https://track-frontend.vercel.app`)
