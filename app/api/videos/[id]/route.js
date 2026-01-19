import { NextResponse } from 'next/server';
import { query } from '../../../../lib/db.js';

export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { views, editor, editorOverride, postedDate, isFetching } = body;
    if (views === undefined && !editor && postedDate === undefined && isFetching === undefined) {
      return NextResponse.json({ error: 'No fields provided' }, { status: 400 });
    }
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
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update video' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    await query('DELETE FROM videos WHERE id = $1', [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete video' }, { status: 500 });
  }
}
