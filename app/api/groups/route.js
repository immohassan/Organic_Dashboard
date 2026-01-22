import { NextResponse } from 'next/server';
import { query } from '../../../lib/db.js';

export async function GET() {
  try {
    const groups = await query(
      `SELECT g.id, g.name, g.created_at,
       COALESCE(
         json_agg(
           json_build_object('editor', ge.editor)
           ORDER BY ge.editor
         ) FILTER (WHERE ge.editor IS NOT NULL),
         '[]'::json
       ) as editors
       FROM editor_groups g
       LEFT JOIN group_editors ge ON g.id = ge.group_id
       GROUP BY g.id, g.name, g.created_at
       ORDER BY g.name`
    );
    return NextResponse.json(groups);
  } catch (err) {
    console.error('Failed to load groups', err);
    return NextResponse.json({ error: 'Failed to load groups' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name } = body;
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
    }
    const rows = await query(
      'INSERT INTO editor_groups (name) VALUES ($1) RETURNING id, name, created_at',
      [name.trim()]
    );
    return NextResponse.json({ id: rows[0].id, name: rows[0].name, created_at: rows[0].created_at, editors: [] });
  } catch (err) {
    if (err.code === '23505') { // Unique constraint violation
      return NextResponse.json({ error: 'Group name already exists' }, { status: 400 });
    }
    console.error('Failed to create group', err);
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
  }
}
