import Database from "better-sqlite3";

const [, , source, destination] = process.argv;
if (!source || !destination) {
  throw new Error("usage: backup-index.mjs <source.db> <destination.db>");
}

const db = new Database(source, { readonly: true, fileMustExist: true });
try {
  await db.backup(destination);
} finally {
  db.close();
}
