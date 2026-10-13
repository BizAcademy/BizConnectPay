import session from 'express-session';

export class MySQLSessionStore extends session.Store {
  constructor(pool, maxAge) {
    super();
    this.pool = pool;
    this.maxAge = maxAge;
    this.timer = setInterval(() => {
      this.pool.execute('DELETE FROM admin_sessions WHERE expires_at < UTC_TIMESTAMP()')
        .catch(() => this.emit('cleanupError'));
    }, 15 * 60 * 1000);
    this.timer.unref();
  }
  get(id, callback) {
    this.pool.execute(
      'SELECT session_data FROM admin_sessions WHERE session_id = ? AND expires_at > UTC_TIMESTAMP()',
      [id],
    ).then(([rows]) => {
      if (!rows.length) return callback(null, null);
      try { callback(null, JSON.parse(rows[0].session_data)); }
      catch (error) { callback(error); }
    }, callback);
  }
  set(id, data, callback = () => {}) {
    const expiry = data.cookie?.expires ? new Date(data.cookie.expires) : new Date(Date.now() + this.maxAge);
    this.pool.execute(
      'INSERT INTO admin_sessions (session_id, expires_at, session_data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at), session_data = VALUES(session_data)',
      [id, expiry, JSON.stringify(data)],
    ).then(() => callback(null), callback);
  }
  touch(id, data, callback = () => {}) {
    const expiry = data.cookie?.expires ? new Date(data.cookie.expires) : new Date(Date.now() + this.maxAge);
    this.pool.execute('UPDATE admin_sessions SET expires_at = ? WHERE session_id = ?', [expiry, id])
      .then(() => callback(null), callback);
  }
  destroy(id, callback = () => {}) {
    this.pool.execute('DELETE FROM admin_sessions WHERE session_id = ?', [id]).then(() => callback(null), callback);
  }
  close() { clearInterval(this.timer); }
}
