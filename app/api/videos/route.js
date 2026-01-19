import { NextResponse } from 'next/server';
import { query } from '../../../lib/db.js';

export async function GET() {
  try {
    const rows = await query(
      'SELECT id, account_id, url, platform, views, posted_date, date_added, editor, editor_override, is_fetching FROM videos ORDER BY date_added DESC'
    );
    return NextResponse.json(
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
    return NextResponse.json({ error: 'Failed to load videos' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { accountId, url, platform, views, postedDate, dateAdded, editor, editorOverride, isFetching } = body;
    if (!url || !platform || !editor || !dateAdded) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const rows = await query(
      `INSERT INTO videos (account_id, url, platform, views, posted_date, date_added, editor, editor_override, is_fetching)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [accountId || null, url, platform, views || 0, postedDate || null, dateAdded, editor, !!editorOverride, !!isFetching]
    );
    return NextResponse.json({ id: rows[0].id });
  } catch (err) {
    console.error('Failed to create video', err);
    return NextResponse.json({ error: 'Failed to create video', detail: err.message }, { status: 500 });
  }
}
