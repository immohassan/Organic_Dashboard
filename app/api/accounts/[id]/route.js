import { NextResponse } from 'next/server';
import { query } from '../../../../lib/db.js';

export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { defaultEditor } = body;
    if (!defaultEditor) {
      return NextResponse.json({ error: 'defaultEditor is required' }, { status: 400 });
    }
    await query('UPDATE accounts SET default_editor = $1 WHERE id = $2', [defaultEditor, id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    await query('DELETE FROM videos WHERE account_id = $1', [id]);
    await query('DELETE FROM accounts WHERE id = $1', [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
