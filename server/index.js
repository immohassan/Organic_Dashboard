import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';

const { Pool } = pg;

const app = express();
const port = process.env.PORT || 5175;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });
const corsOrigin = process.env.CORS_ORIGIN || '*';

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

const query = async (text, params) => {
  const result = await pool.query(text, params);
  return result.rows;
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/settings', async (_req, res) => {
  try {
    const rows = await query('SELECT id, last_updated FROM settings WHERE id = $1', ['config']);
    if (rows.length === 0) {
      return res.json({ id: 'config', lastUpdated: null });
    }
    return res.json({ id: rows[0].id, lastUpdated: rows[0].last_updated });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load settings' });
  }
});

app.patch('/api/settings', async (req, res) => {
  const { lastUpdated } = req.body;
  if (!lastUpdated) {
    return res.status(400).json({ error: 'lastUpdated is required' });
  }
  try {
    await query(
      'INSERT INTO settings (id, last_updated) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET last_updated = $2',
      ['config', lastUpdated]
    );
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update settings' });
  }
});

app.get('/api/accounts', async (_req, res) => {
  try {
    const rows = await query('SELECT id, platform, handle, url, default_editor FROM accounts ORDER BY created_at ASC');
    return res.json(
      rows.map((row) => ({
        id: row.id,
        platform: row.platform,
        handle: row.handle,
        url: row.url,
        defaultEditor: row.default_editor
      }))
    );
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load accounts' });
  }
});

app.post('/api/accounts', async (req, res) => {
  const { platform, handle, url, defaultEditor } = req.body;
  if (!platform || !handle || !url || !defaultEditor) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const rows = await query(
      'INSERT INTO accounts (platform, handle, url, default_editor) VALUES ($1, $2, $3, $4) RETURNING id',
      [platform, handle, url, defaultEditor]
    );
    return res.json({ id: rows[0].id });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create account' });
  }
});

app.patch('/api/accounts/:id', async (req, res) => {
  const { id } = req.params;
  const { defaultEditor } = req.body;
  if (!defaultEditor) {
    return res.status(400).json({ error: 'defaultEditor is required' });
  }
  try {
    await query('UPDATE accounts SET default_editor = $1 WHERE id = $2', [defaultEditor, id]);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update account' });
  }
});

app.delete('/api/accounts/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM videos WHERE account_id = $1', [id]);
    await query('DELETE FROM accounts WHERE id = $1', [id]);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete account' });
  }
});

app.get('/api/videos', async (_req, res) => {
  try {
    const rows = await query(
      'SELECT id, account_id, url, platform, views, posted_date, date_added, editor, editor_override, is_fetching FROM videos ORDER BY date_added DESC'
    );
    return res.json(
      rows.map((row) => ({
        id: row.id,
        accountId: row.account_id,
        url: row.url,
        platform: row.platform,
        views: row.views,
        postedDate: row.posted_date,
        dateAdded: row.date_added,
        editor: row.editor,
        editorOverride: row.editor_override,
        isFetching: row.is_fetching
      }))
    );
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load videos' });
  }
});

app.post('/api/videos', async (req, res) => {
  const { accountId, url, platform, views, postedDate, dateAdded, editor, editorOverride, isFetching } = req.body;
  if (!url || !platform || !editor || !dateAdded) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const rows = await query(
      `INSERT INTO videos (account_id, url, platform, views, posted_date, date_added, editor, editor_override, is_fetching)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [accountId || null, url, platform, views || 0, postedDate || null, dateAdded, editor, !!editorOverride, !!isFetching]
    );
    return res.json({ id: rows[0].id });
  } catch (err) {
    console.error('Failed to create video', err);
    return res.status(500).json({ error: 'Failed to create video', detail: err.message });
  }
});

app.patch('/api/videos/:id', async (req, res) => {
  const { id } = req.params;
  const { views, editor, editorOverride, postedDate, isFetching } = req.body;
  if (views === undefined && !editor && postedDate === undefined && isFetching === undefined) {
    return res.status(400).json({ error: 'No fields provided' });
  }
  try {
    if (views !== undefined) {
      await query('UPDATE videos SET views = $1 WHERE id = $2', [views, id]);
    }
    if (editor) {
      await query('UPDATE videos SET editor = $1, editor_override = $2 WHERE id = $3', [
        editor,
        !!editorOverride,
        id
      ]);
    }
    if (postedDate !== undefined) {
      await query('UPDATE videos SET posted_date = $1 WHERE id = $2', [postedDate || null, id]);
    }
    if (isFetching !== undefined) {
      await query('UPDATE videos SET is_fetching = $1 WHERE id = $2', [!!isFetching, id]);
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update video' });
  }
});

app.delete('/api/videos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM videos WHERE id = $1', [id]);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete video' });
  }
});

app.listen(port, () => {
  console.log(`API running on port ${port}`);
});
