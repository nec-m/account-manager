import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { initializeAuthStore } from '../auth/repository.js';
import { readDataFromDb, writeDataToDb } from './dataRepository.js';
import { initializeSchema } from './schema.js';

const dbPath = path.join(process.cwd(), 'data.db');

let dbInstance = null;
let dbInitializationPromise = null;

async function initializeDb() {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  try {
    // 开启外键校验，并使用 WAL 提升并发读写性能与崩溃安全性
    await db.exec('PRAGMA foreign_keys = ON;');
    await db.exec('PRAGMA journal_mode = WAL;');

    await initializeSchema(db);
    await initializeAuthStore(db, {
      initialAdminUsername: process.env.INITIAL_ADMIN_USERNAME,
      initialAdminPassword: process.env.INITIAL_ADMIN_PASSWORD,
    });

    return db;
  } catch (error) {
    await db.close().catch(() => {});
    throw error;
  }
}

/**
 * 获取或初始化 SQLite 数据库单例
 */
export async function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  if (!dbInitializationPromise) {
    dbInitializationPromise = initializeDb();
  }
  const initialization = dbInitializationPromise;

  try {
    dbInstance = await initialization;
    return dbInstance;
  } finally {
    if (dbInitializationPromise === initialization) {
      dbInitializationPromise = null;
    }
  }
}

/**
 * 读取全量数据（兼容原接口）
 */
export async function readData() {
  const db = await getDb();
  return readDataFromDb(db);
}

/**
 * 写入/覆盖全量数据（使用 SQLite 事务，原子提交）
 */
export async function writeData(data) {
  const db = await getDb();
  return writeDataToDb(db, data);
}

export { initializeSchema, readDataFromDb, writeDataToDb };
