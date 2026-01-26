import 'dotenv/config';
import pg from 'pg';
import nodeCron from 'node-cron';

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
const apifyToken = process.env.NEXT_PUBLIC_APIFY_TOKEN;
const rapidApiKey = process.env.NEXT_PUBLIC_RAPIDAPI_KEY;

if (!databaseUrl) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

if (!apifyToken) {
  console.error('Missing NEXT_PUBLIC_APIFY_TOKEN');
  process.exit(1);
}

if (!rapidApiKey) {
  console.error('Missing NEXT_PUBLIC_RAPIDAPI_KEY');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

const query = async (text, params) => {
  const result = await pool.query(text, params);
  return result.rows;
};

// Helper functions (same as in App.jsx)
const normalizeInstagramVideoUrl = (url) => {
  if (!url) return url;
  if (url.includes('/reel/')) return url;
  const match = url.match(/instagram\.com\/p\/([a-zA-Z0-9_-]+)/i);
  if (match?.[1]) {
    return `https://www.instagram.com/p/${match[1]}/`;
  }
  return url;
};

const fetchAccountVideoUrls = async ({ token, platform, handle, profileUrl }) => {
  let response;
  if (platform === 'Instagram') {
    // Use RapidAPI for Instagram - returns both URLs and play counts with pagination
    const rapidApiHeaders = new Headers();
    rapidApiHeaders.append('Content-Type', 'application/x-www-form-urlencoded');
    rapidApiHeaders.append('x-rapidapi-host', 'instagram-scraper-stable-api.p.rapidapi.com');
    rapidApiHeaders.append('x-rapidapi-key', token);
    
    const allReels = [];
    let paginationToken = '';
    
    // Fetch all pages until there's no more pagination token
    do {
      const formData = new URLSearchParams();
      formData.append('username_or_url', profileUrl);
      formData.append('amount', '30');
      formData.append('pagination_token', paginationToken);
      
      response = await fetch(
        'https://instagram-scraper-stable-api.p.rapidapi.com/get_ig_user_reels.php',
        {
          method: 'POST',
          headers: rapidApiHeaders,
          body: formData
        }
      );
      
      if (!response.ok) {
        throw new Error('RapidAPI request failed');
      }
      
      const data = await response.json();
      if (data.reels && Array.isArray(data.reels)) {
        allReels.push(...data.reels);
      }
      
      // Update pagination token for next iteration
      paginationToken = data.pagination_token || '';
    } while (paginationToken);
    
    // Return objects with url and views for Instagram
    return allReels.map((reel) => ({
      url: `https://instagram.com/p/${reel.node.media.code}`,
      views: reel.node.media.play_count || 0
    })).filter((item) => item.url);
  } else {
    // Use RapidAPI for TikTok - returns both URLs and play counts with pagination
    const rapidApiHeaders = new Headers();
    rapidApiHeaders.append('x-rapidapi-host', 'tiktok-scraper7.p.rapidapi.com');
    rapidApiHeaders.append('x-rapidapi-key', token);
    
    const allVideos = [];
    let cursor = '0';
    let hasMore = true;
    
    // Fetch all pages until there's no more data
    while (hasMore) {
      const url = `https://tiktok-scraper7.p.rapidapi.com/user/posts?unique_id=${handle}&count=30&cursor=${cursor}`;
      
      response = await fetch(url, {
        method: 'GET',
        headers: rapidApiHeaders
      });
      
      if (!response.ok) {
        throw new Error('RapidAPI TikTok request failed');
      }
      
      const data = await response.json();
      
      if (data.data && data.data.videos && Array.isArray(data.data.videos)) {
        allVideos.push(...data.data.videos);
      }
      
      // Update cursor and hasMore for next iteration
      cursor = data.data?.cursor || '';
      hasMore = data.data?.hasMore || false;
      
      // Break if no cursor or hasMore is false
      if (!cursor || !hasMore) {
        break;
      }
    }
    
    // Return objects with url and views for TikTok
    // Note: The API response shows play_count and create_time, but we need aweme_id or video_id for URL
    return allVideos.map((video) => {
      // Try to get video ID from various possible fields
      const videoId = video.aweme_id || video.video_id || video.id || video.awemeId || '';
      
      // Construct TikTok video URL if we have an ID
      const videoUrl = videoId 
        ? `https://www.tiktok.com/@${handle}/video/${videoId}`
        : (video.url || video.webVideoUrl || video.share_url || '');
      
      return {
        url: videoUrl,
        views: video.play_count || 0
      };
    }).filter((item) => item.url);
  }
};

const extractInstagramStats = (items) => {
  if (!Array.isArray(items) || items.length === 0) return { views: null, postedDate: '' };
  const item = items[0];
  const viewsRaw = item.video_view_count ?? item.video_play_count ?? item.playCount ?? null;
  const views = viewsRaw !== null ? parseInt(`${viewsRaw}`.replace(/,/g, ''), 10) : null;
  const postedDateRaw = item.date_posted ?? item.timestamp ?? '';
  const postedDate = postedDateRaw ? new Date(postedDateRaw).toISOString().split('T')[0] : '';
  return { views: Number.isNaN(views) ? null : views, postedDate };
};

const extractTikTokStats = (items) => {
  if (!Array.isArray(items) || items.length === 0) return { views: null, postedDate: '' };
  const item = items[0];
  const viewsRaw = item.playCount ?? item.viewCount ?? null;
  const views = viewsRaw !== null ? parseInt(`${viewsRaw}`.replace(/,/g, ''), 10) : null;
  const postedDateRaw = item.createTime ?? '';
  const postedDate = postedDateRaw ? new Date(postedDateRaw).toISOString().split('T')[0] : '';
  return { views: Number.isNaN(views) ? null : views, postedDate };
};

const fetchVideoStats = async ({ token, url, platform }) => {
  const headers = new Headers();
  headers.append('Content-Type', 'application/json');
  headers.append('Accept', 'application/json');

  let runResponse;
  if (platform === 'Instagram') {
    runResponse = await fetch(
      `https://api.apify.com/v2/acts/wj7yXss2honyonHJ8/run-sync-get-dataset-items?token=${token}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: normalizeInstagramVideoUrl(url) })
      }
    );
  } else {
    runResponse = await fetch(
      `https://api.apify.com/v2/acts/rFfyNgnvUxD1bm8hh/run-sync-get-dataset-items?token=${token}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          shouldDownloadCovers: false,
          shouldDownloadVideos: false,
          shouldGetTranscript: false,
          videos: [url]
        })
      }
    );
  }

  if (!runResponse.ok) {
    throw new Error('Apify run failed');
  }

  const items = await runResponse.json();
  const stats = platform === 'Instagram' ? extractInstagramStats(items) : extractTikTokStats(items);
  return stats;
};

const refreshAccount = async (account) => {
  console.log(`[${new Date().toISOString()}] Starting refresh for @${account.handle} (${account.platform})`);
  
  try {
    // Fetch latest video data (URLs for TikTok, {url, views} objects for Instagram)
    const token = account.platform === 'Instagram' ? rapidApiKey : apifyToken;
    const videoData = await fetchAccountVideoUrls({
      token,
      platform: account.platform,
      handle: account.handle,
      profileUrl: account.url
    });

    if (!videoData.length) {
      console.log(`[${new Date().toISOString()}] No videos found for @${account.handle}`);
      // Update last_refreshed even if no videos found
      await query('UPDATE accounts SET last_refreshed = $1 WHERE id = $2', [new Date(), account.id]);
      return;
    }

    // Get existing video URLs for this account
    const existingVideos = await query('SELECT url FROM videos WHERE account_id = $1', [account.id]);
    const existingUrls = new Set(existingVideos.map(v => v.url));

    const today = new Date().toISOString().split('T')[0];
    const newVideos = [];

    if (account.platform === 'Instagram') {
      // For Instagram, videoData is an array of {url, views} objects
      for (const video of videoData) {
        if (!existingUrls.has(video.url)) {
          // New video - add with views already available
          const rows = await query(
            `INSERT INTO videos (account_id, url, platform, views, posted_date, date_added, editor, editor_override, is_fetching)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
            [account.id, video.url, account.platform, video.views || 0, null, today, account.default_editor, false, false]
          );
          newVideos.push({ id: rows[0].id, url: video.url });
          console.log(`[${new Date().toISOString()}] Added new video: ${video.url} with ${video.views || 0} views`);
        } else {
          // Update existing video with new views
          await query(
            'UPDATE videos SET views = $1, is_fetching = $2 WHERE account_id = $3 AND url = $4',
            [video.views || 0, false, account.id, video.url]
          );
          console.log(`[${new Date().toISOString()}] Updated views for ${video.url}: ${video.views || 0}`);
        }
      }
    } else {
      // For TikTok, videoData is an array of URLs
      const urls = videoData;
      
      // Check for new videos and add them
      for (const videoUrl of urls) {
        if (!existingUrls.has(videoUrl)) {
          // New video - add as placeholder
          const rows = await query(
            `INSERT INTO videos (account_id, url, platform, views, posted_date, date_added, editor, editor_override, is_fetching)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
            [account.id, videoUrl, account.platform, 0, null, today, account.default_editor, false, true]
          );
          newVideos.push({ id: rows[0].id, url: videoUrl });
          console.log(`[${new Date().toISOString()}] Added new video: ${videoUrl}`);
        }
      }

      // Get all videos for this account (existing + new) to update views
      const allAccountVideos = await query('SELECT id, url FROM videos WHERE account_id = $1', [account.id]);

      // Process videos sequentially to update views
      for (const video of allAccountVideos) {
        try {
          const stats = await fetchVideoStats({ token: apifyToken, url: video.url, platform: account.platform });
          
          if (stats.views === null) {
            // Retry once after 3 seconds
            await new Promise(resolve => setTimeout(resolve, 3000));
            const retryStats = await fetchVideoStats({ token: apifyToken, url: video.url, platform: account.platform });
            
            if (retryStats.views === null) {
              await query('UPDATE videos SET is_fetching = $1 WHERE id = $2', [false, video.id]);
              console.log(`[${new Date().toISOString()}] Could not fetch views for ${video.url}`);
            } else {
              await query(
                'UPDATE videos SET views = $1, posted_date = $2, is_fetching = $3 WHERE id = $4',
                [retryStats.views, retryStats.postedDate || today, false, video.id]
              );
              console.log(`[${new Date().toISOString()}] Updated views for ${video.url}: ${retryStats.views}`);
            }
          } else {
            await query(
              'UPDATE videos SET views = $1, posted_date = $2, is_fetching = $3 WHERE id = $4',
              [stats.views, stats.postedDate || today, false, video.id]
            );
            console.log(`[${new Date().toISOString()}] Updated views for ${video.url}: ${stats.views}`);
          }
        } catch (error) {
          console.error(`[${new Date().toISOString()}] Error fetching stats for ${video.url}:`, error.message);
          await query('UPDATE videos SET is_fetching = $1 WHERE id = $2', [false, video.id]);
        }
      }
    }

    // Get final count for logging
    const allAccountVideos = await query('SELECT id FROM videos WHERE account_id = $1', [account.id]);

    // Update last_refreshed timestamp
    await query('UPDATE accounts SET last_refreshed = $1 WHERE id = $2', [new Date(), account.id]);
    console.log(`[${new Date().toISOString()}] Completed refresh for @${account.handle} - ${allAccountVideos.length} videos processed, ${newVideos.length} new videos added`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error refreshing @${account.handle}:`, error.message);
    // Still update last_refreshed even on error
    await query('UPDATE accounts SET last_refreshed = $1 WHERE id = $2', [new Date(), account.id]);
  }
};

const refreshAllAccounts = async () => {
  console.log(`[${new Date().toISOString()}] ===== Starting scheduled account refresh =====`);
  
  try {
    const accounts = await query('SELECT id, platform, handle, url, default_editor FROM accounts ORDER BY created_at ASC');
    
    if (accounts.length === 0) {
      console.log(`[${new Date().toISOString()}] No accounts to refresh`);
      return;
    }

    console.log(`[${new Date().toISOString()}] Found ${accounts.length} account(s) to refresh`);

    // Process accounts sequentially
    for (const account of accounts) {
      await refreshAccount(account);
      // Small delay between accounts to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`[${new Date().toISOString()}] ===== Completed scheduled account refresh =====`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Fatal error in refreshAllAccounts:`, error);
  }
};

// Run every 6 hours: '0 */6 * * *'
// For testing, you can use: '*/5 * * * *' (every 5 minutes)
nodeCron.schedule('0 */6 * * *', () => {
  refreshAllAccounts();
});

console.log('Account refresh cron job started. Will run every 6 hours.');
console.log('Press Ctrl+C to stop.');

// Keep the process running
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  pool.end();
  process.exit(0);
});
