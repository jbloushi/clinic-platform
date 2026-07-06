import { createPool, type Pool } from 'mysql2/promise';

/**
 * Direct MariaDB connection to the local OpenEMR install. Used ONLY to compensate
 * for gaps in the OpenEMR 8.0 REST API surface — specifically to mark a newly
 * created practitioner as `authorized=1` and give them a username so they show
 * up in `/api/practitioner`.
 *
 * This is deliberately kept behind a single function and clearly scoped. Any
 * real production deployment should either wait for OpenEMR to expose these
 * fields via the REST API or ship a small custom OpenEMR module.
 */

let pool: Pool | null = null;

function getPool(): Pool | null {
  const url = process.env.OPENEMR_DB_URL;
  if (!url) return null;
  if (!pool) {
    pool = createPool(url + '?multipleStatements=false&connectionLimit=4');
  }
  return pool;
}

export async function authorizePractitioner(uuid: string, opts: { username?: string } = {}): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  const hex = uuid.replace(/-/g, '');
  const username = opts.username;

  const sql = `
    UPDATE users
    SET authorized = 1,
        active = 1,
        username = COALESCE(username, ?)
    WHERE uuid = UNHEX(?)
  `;
  const [res] = (await p.query(sql, [username ?? null, hex])) as any;
  return res?.affectedRows > 0;
}
