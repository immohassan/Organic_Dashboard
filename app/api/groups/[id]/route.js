import { NextResponse } from 'next/server';
import { query } from '../../../../lib/db.js';

export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { name } = body;
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
    }
    await query('UPDATE editor_groups SET name = $1 WHERE id = $2', [name.trim(), id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err.code === '23505') { // Unique constraint violation
      return NextResponse.json({ error: 'Group name already exists' }, { status: 400 });
    }
    console.error('Failed to update group', err);
    return NextResponse.json({ error: 'Failed to update group' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    await query('DELETE FROM editor_groups WHERE id = $1', [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Failed to delete group', err);
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 });
  }
}
