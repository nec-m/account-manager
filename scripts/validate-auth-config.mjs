import { getDb } from '../lib/db.js';

try {
  await getDb();
  console.log('认证配置校验完成。');
} catch {
  console.error('认证初始化配置无效，请检查初始管理员配置后重试。');
  process.exitCode = 1;
}
