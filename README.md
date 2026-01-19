# Organic Video Performance Tracker

A Next.js application to track video performance metrics from Instagram and TikTok accounts.

## Features

- Track videos from Instagram and TikTok accounts
- View performance metrics by editor
- Real-time view count updates
- Batch processing of video stats (3 at a time)
- Automatic account refresh every 6 hours (background process)
- Manager login system for editing access

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env.local` file in the root directory:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/database_name
   NEXT_PUBLIC_APIFY_TOKEN=your_apify_token_here
   NEXT_PUBLIC_MANAGER_CODE=your_manager_code_here
   ```

3. **Set up the database:**
   - Make sure PostgreSQL is running
   - Run the SQL schema from `server/schema.sql` to create the necessary tables
   - Run the schema update: `server/schema_update.sql` to add `last_refreshed` column

4. **Run the development server:**
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:3000`

5. **Set up the background refresh script (for VPS):**
   
   Install PM2 globally (if not already installed):
   ```bash
   npm install -g pm2
   ```
   
   Start the refresh script:
   ```bash
   pm2 start scripts/refresh-accounts.js --name account-refresher
   pm2 save
   pm2 startup  # Follow instructions to enable auto-start on boot
   ```
   
   The script will automatically refresh all accounts every 6 hours.

## Project Structure

- `app/` - Next.js app directory with pages and API routes
- `app/api/` - API routes (replaces the Express server)
- `lib/db.js` - Database connection utility
- `scripts/refresh-accounts.js` - Background cron job for auto-refreshing accounts
- `src/App.jsx` - Main React component
- `server/` - SQL schema files

## API Routes

All API routes are now Next.js API routes:
- `GET/PATCH /api/settings` - Settings management
- `GET/POST /api/accounts` - Account management
- `PATCH/DELETE /api/accounts/[id]` - Individual account operations
- `GET/POST /api/videos` - Video management
- `PATCH/DELETE /api/videos/[id]` - Individual video operations

## Background Refresh

The `scripts/refresh-accounts.js` script runs automatically every 6 hours to:
- Fetch latest video URLs for all accounts
- Add any new videos found
- Update view counts for all videos
- Update `last_refreshed` timestamp for each account

The script processes accounts sequentially to avoid rate limits and runs completely independently of the frontend.

## Manager Login

- Click the "Login" button in the header
- Enter the manager code (set in `NEXT_PUBLIC_MANAGER_CODE`)
- Once logged in, you can add/edit/delete accounts and videos
- Click "Manager" button to log out (dashboard becomes view-only)

## Production Build

```bash
npm run build
npm start
```

Make sure to also run the background refresh script with PM2 in production.
