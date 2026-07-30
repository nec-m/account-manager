/**
 * 初始化 SQLite 表结构，并兼容已存在数据库的列迁移。
 */
export async function initializeSchema(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      site TEXT,
      username TEXT,
      password TEXT,
      expireDate TEXT,
      twoFaUrl TEXT,
      twoFaKey TEXT,
      emailUrl TEXT,
      emailKey TEXT,
      status TEXT,
      archivedPhoneSnapshot TEXT DEFAULT '',
      note TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS phones (
      id TEXT PRIMARY KEY,
      number TEXT,
      expireDate TEXT,
      smsUrl TEXT,
      smsKey TEXT,
      boundAccountId TEXT,
      status TEXT,
      note TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS phone_account_history (
      phoneId TEXT NOT NULL,
      accountId TEXT NOT NULL,
      siteSnapshot TEXT NOT NULL DEFAULT '',
      usernameSnapshot TEXT NOT NULL DEFAULT '',
      firstBoundAt TEXT NOT NULL,
      lastBoundAt TEXT NOT NULL,
      PRIMARY KEY (phoneId, accountId)
    );

    CREATE INDEX IF NOT EXISTS idx_phone_account_history_phone_recent
      ON phone_account_history (phoneId, lastBoundAt DESC);
  `);

  const accountColumns = await db.all('PRAGMA table_info(accounts)');
  if (!accountColumns.some((column) => column.name === 'archivedPhoneSnapshot')) {
    await db.exec("ALTER TABLE accounts ADD COLUMN archivedPhoneSnapshot TEXT DEFAULT ''");
  }
  if (!accountColumns.some((column) => column.name === 'note')) {
    await db.exec("ALTER TABLE accounts ADD COLUMN note TEXT DEFAULT ''");
  }

  const phoneColumns = await db.all('PRAGMA table_info(phones)');
  if (!phoneColumns.some((column) => column.name === 'note')) {
    await db.exec("ALTER TABLE phones ADD COLUMN note TEXT DEFAULT ''");
  }
}
