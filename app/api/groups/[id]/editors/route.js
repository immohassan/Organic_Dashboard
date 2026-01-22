import { NextResponse } from 'next/server';
import { query } from '../../../../../lib/db.js';

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { editor } = body;
    if (!editor || !editor.trim()) {
      return NextResponse.json({ error: 'Editor name is required' }, { status: 400 });
    }
    await query(
      'INSERT INTO group_editors (group_id, editor) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [id, editor.trim()]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Failed to add editor to group', err);
    return NextResponse.json({ error: 'Failed to add editor to group' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const editor = searchParams.get('editor');
    if (!editor) {
      return NextResponse.json({ error: 'Editor name is required' }, { status: 400 });
    }
    await query('DELETE FROM group_editors WHERE group_id = $1 AND editor = $2', [id, editor]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Failed to remove editor from group', err);
    return NextResponse.json({ error: 'Failed to remove editor from group' }, { status: 500 });
  }
}
