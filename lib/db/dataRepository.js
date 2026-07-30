import {
  InvalidPhoneBindingError,
  planPhoneAccountHistoryChanges,
} from '../phoneAccountHistory.js';
import { serializeDbOperation } from './operationQueue.js';

/**
 * 读取指定 SQLite 连接中的全量数据，供生产代码和内存数据库测试复用。
 */
export async function readDataFromDb(db) {
  return serializeDbOperation(db, () => readDataFromDbRaw(db));
}

async function readDataFromDbRaw(db) {
  const accounts = await db.all('SELECT * FROM accounts');
  const phones = await db.all('SELECT * FROM phones');
  const phoneAccountHistory = await db.all(`
    SELECT phoneId, accountId, siteSnapshot, usernameSnapshot, firstBoundAt, lastBoundAt
    FROM phone_account_history
    ORDER BY phoneId, lastBoundAt DESC
  `);
  return { accounts, phones, phoneAccountHistory };
}

/**
 * 在单个事务中替换账号和手机数据，并维护手机与账号的历史关联。
 */
export async function writeDataToDb(db, data, { now = new Date().toISOString() } = {}) {
  return serializeDbOperation(db, () => writeDataToDbRaw(db, data, now));
}

async function writeDataToDbRaw(db, data, now) {
  let transactionStarted = false;
  try {
    await db.exec('BEGIN IMMEDIATE;');
    transactionStarted = true;

    const previousPhones = await db.all('SELECT id, boundAccountId FROM phones');
    const { newBindings, accountSnapshots, deletedPhoneIds } = planPhoneAccountHistoryChanges({
      previousPhones,
      nextPhones: data.phones,
      nextAccounts: data.accounts,
    });

    const upsertHistory = await db.prepare(`
      INSERT INTO phone_account_history (
        phoneId, accountId, siteSnapshot, usernameSnapshot, firstBoundAt, lastBoundAt
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(phoneId, accountId) DO UPDATE SET
        siteSnapshot = excluded.siteSnapshot,
        usernameSnapshot = excluded.usernameSnapshot,
        lastBoundAt = excluded.lastBoundAt
    `);
    for (const binding of newBindings) {
      await upsertHistory.run(
        binding.phoneId,
        binding.accountId,
        binding.siteSnapshot,
        binding.usernameSnapshot,
        now,
        now,
      );
    }
    await upsertHistory.finalize();

    const updateSnapshots = await db.prepare(`
      UPDATE phone_account_history
      SET siteSnapshot = ?, usernameSnapshot = ?
      WHERE accountId = ?
    `);
    for (const snapshot of accountSnapshots) {
      await updateSnapshots.run(snapshot.siteSnapshot, snapshot.usernameSnapshot, snapshot.accountId);
    }
    await updateSnapshots.finalize();

    // 清空原数据
    await db.exec('DELETE FROM accounts;');
    await db.exec('DELETE FROM phones;');

    // 批量插入 accounts
    if (Array.isArray(data.accounts)) {
      const insertAccount = await db.prepare(`
        INSERT INTO accounts (id, site, username, password, expireDate, twoFaUrl, twoFaKey, emailUrl, emailKey, status, archivedPhoneSnapshot, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const acc of data.accounts) {
        await insertAccount.run(
          acc.id || String(Date.now() + Math.random()),
          acc.site || '',
          acc.username || '',
          acc.password || '',
          acc.expireDate || '',
          acc.twoFaUrl || '',
          acc.twoFaKey || '',
          acc.emailUrl || '',
          acc.emailKey || '',
          acc.status || 'active',
          acc.archivedPhoneSnapshot || '',
          acc.note || ''
        );
      }
      await insertAccount.finalize();
    }

    // 批量插入 phones
    if (Array.isArray(data.phones)) {
      const insertPhone = await db.prepare(`
        INSERT INTO phones (id, number, expireDate, smsUrl, smsKey, boundAccountId, status, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const phone of data.phones) {
        await insertPhone.run(
          phone.id || String(Date.now() + Math.random()),
          phone.number || '',
          phone.expireDate || '',
          phone.smsUrl || '',
          phone.smsKey || '',
          phone.boundAccountId || null,
          phone.status || 'active',
          phone.note || ''
        );
      }
      await insertPhone.finalize();
    }

    if (deletedPhoneIds.length > 0) {
      const deleteHistory = await db.prepare('DELETE FROM phone_account_history WHERE phoneId = ?');
      for (const phoneId of deletedPhoneIds) {
        await deleteHistory.run(phoneId);
      }
      await deleteHistory.finalize();
    }

    await db.exec('COMMIT;');
    transactionStarted = false;
    return readDataFromDbRaw(db);
  } catch (err) {
    if (transactionStarted) {
      await db.exec('ROLLBACK;').catch(() => {});
    }
    if (!(err instanceof InvalidPhoneBindingError)) {
      console.error('SQLite writeData error:', err);
    }
    throw err;
  }
}
