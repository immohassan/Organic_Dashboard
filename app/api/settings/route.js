import { NextResponse } from 'next/server';
import { query } from '../../../lib/db.js';

export async function GET() {
  try {
    const rows = await query('SELECT id, last_updated FROM settings WHERE id = $1', ['config']);
    if (rows.length === 0) {
      return NextResponse.json({ id: 'config', lastUpdated: null });
    }
    return NextResponse.json({ id: rows[0].id, lastUpdated: rows[0].last_updated });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { lastUpdated } = body;
    if (!lastUpdated) {
      return NextResponse.json({ error: 'lastUpdated is required' }, { status: 400 });
    }
    await query(
      'INSERT INTO settings (id, last_updated) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET last_updated = $2',
      ['config', lastUpdated]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
