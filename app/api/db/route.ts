import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sort') || '';
    const sortDir = searchParams.get('dir') === 'asc' ? 'ASC' : 'DESC';

    // List tables
    if (!table) {
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      ).all() as { name: string }[];

      const tableCounts = tables.map(t => {
        const count = db.prepare(`SELECT COUNT(*) as count FROM "${t.name}"`).get() as { count: number };
        return { name: t.name, count: count.count };
      });

      return NextResponse.json({ tables: tableCounts });
    }

    // Validate table name (prevent SQL injection)
    const validTables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = ?"
    ).get(table) as { name: string } | undefined;

    if (!validTables) {
      return NextResponse.json({ error: `Table "${table}" not found` }, { status: 404 });
    }

    // Get columns
    const columns = db.prepare(`PRAGMA table_info("${table}")`).all() as {
      name: string; type: string; notnull: number; pk: number;
    }[];

    // Build query
    const offset = (page - 1) * limit;
    let whereClause = '';
    const params: unknown[] = [];

    if (search) {
      const textCols = columns.filter(c =>
        c.type.toUpperCase().includes('TEXT') || c.type === ''
      );
      if (textCols.length > 0) {
        whereClause = 'WHERE ' + textCols.map(c => `"${c.name}" LIKE ?`).join(' OR ');
        textCols.forEach(() => params.push(`%${search}%`));
      }
    }

    const orderClause = sortBy && columns.some(c => c.name === sortBy)
      ? `ORDER BY "${sortBy}" ${sortDir}`
      : `ORDER BY rowid DESC`;

    const countResult = db.prepare(
      `SELECT COUNT(*) as total FROM "${table}" ${whereClause}`
    ).get(...params) as { total: number };

    const rows = db.prepare(
      `SELECT * FROM "${table}" ${whereClause} ${orderClause} LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    return NextResponse.json({
      table,
      columns: columns.map(c => ({ name: c.name, type: c.type, pk: c.pk })),
      rows,
      total: countResult.total,
      page,
      limit,
      totalPages: Math.ceil(countResult.total / limit),
    });
  } catch (error) {
    console.error('[API] GET /api/db error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
