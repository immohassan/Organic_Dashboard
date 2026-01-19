import { NextResponse } from 'next/server';
import { query } from '../../../lib/db.js';

export async function GET() {
  try {
    const rows = await query('SELECT id, platform, handle, url, default_editor, last_refreshed FROM accounts ORDER BY created_at ASC');
    return NextResponse.json(
      rows.map((row) => ({
        id: row.id,
        platform: row.platform,
        handle: row.handle,
        url: row.url,
        defaultEditor: row.default_editor,
        lastRefreshed: row.last_refreshed
      }))
    );
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load accounts' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { platform, handle, url, defaultEditor } = body;
    if (!platform || !handle || !url || !defaultEditor) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const rows = await query(
      'INSERT INTO accounts (platform, handle, url, default_editor) VALUES ($1, $2, $3, $4) RETURNING id',
      [platform, handle, url, defaultEditor]
    );
    return NextResponse.json({ id: rows[0].id });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
