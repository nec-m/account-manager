const dbOperationQueues = new WeakMap();

export function serializeDbOperation(db, operation) {
  const previous = dbOperationQueues.get(db) || Promise.resolve();
  const current = previous.then(operation);
  const settled = current.catch(() => {});
  dbOperationQueues.set(db, settled);
  return current.finally(() => {
    if (dbOperationQueues.get(db) === settled) dbOperationQueues.delete(db);
  });
}
