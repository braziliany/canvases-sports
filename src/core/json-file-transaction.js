import { randomUUID } from "node:crypto";
import { copyFile, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

async function readOriginal(path) {
  try {
    return { existed: true, content: await readFile(path) };
  } catch (error) {
    if (error.code === "ENOENT") return { existed: false, content: null };
    throw error;
  }
}

async function removeIfPresent(path) {
  try {
    await unlink(path);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function replaceWithCopy(sourcePath, targetPath) {
  await copyFile(sourcePath, targetPath);
}

export async function commitJsonFilesAtomically(entries, { replaceFile = replaceWithCopy } = {}) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new TypeError("entries must contain at least one file");
  }
  const targets = entries.map((entry) => entry.path);
  if (new Set(targets).size !== targets.length) throw new TypeError("transaction paths must be unique");

  const transactionId = `${process.pid}-${randomUUID()}`;
  const staged = [];
  const originals = new Map();
  try {
    for (const entry of entries) {
      const temporaryPath = join(
        dirname(entry.path),
        `.${basename(entry.path)}.${transactionId}.tmp`
      );
      originals.set(entry.path, await readOriginal(entry.path));
      await writeFile(temporaryPath, `${JSON.stringify(entry.data, null, 2)}\n`, "utf8");
      staged.push({ ...entry, temporaryPath });
    }

    for (const [index, entry] of staged.entries()) {
      await replaceFile(entry.temporaryPath, entry.path, index);
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const entry of entries) {
      try {
        const original = originals.get(entry.path);
        if (!original) continue;
        if (original.existed) await writeFile(entry.path, original.content);
        else await removeIfPresent(entry.path);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length) {
      throw new AggregateError([error, ...rollbackErrors], "Settlement failed and rollback was incomplete");
    }
    throw error;
  } finally {
    await Promise.all(staged.map((entry) => removeIfPresent(entry.temporaryPath)));
  }
}
