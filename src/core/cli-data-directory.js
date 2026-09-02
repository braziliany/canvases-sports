import { realpath, stat } from "node:fs/promises";
import { isAbsolute } from "node:path";

export class IsolationPathError extends Error {
  constructor(message) {
    super(message);
    this.name = "IsolationPathError";
  }
}

async function existingDirectory(path, label) {
  let resolved;
  try {
    resolved = await realpath(path);
    const details = await stat(resolved);
    if (!details.isDirectory()) throw new Error("not a directory");
  } catch {
    throw new IsolationPathError(`${label} must be an existing directory: ${path}`);
  }
  return resolved;
}

export async function resolveCliDataDirectory(argumentsList, officialDataDirectory) {
  const remainingArguments = [];
  let isolationPath = null;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument !== "--isolated-data-dir") {
      remainingArguments.push(argument);
      continue;
    }
    if (isolationPath !== null) {
      throw new IsolationPathError("--isolated-data-dir may only be provided once");
    }
    const value = argumentsList[index + 1];
    if (!value || value.startsWith("--")) {
      throw new IsolationPathError("--isolated-data-dir requires an absolute directory path");
    }
    if (!isAbsolute(value)) {
      throw new IsolationPathError("--isolated-data-dir must be an absolute path");
    }
    isolationPath = value;
    index += 1;
  }

  if (isolationPath === null) {
    return {
      dataDirectory: officialDataDirectory,
      isolated: false,
      remainingArguments
    };
  }

  const [officialRealPath, isolatedRealPath] = await Promise.all([
    existingDirectory(officialDataDirectory, "Official data directory"),
    existingDirectory(isolationPath, "Isolated data directory")
  ]);
  if (officialRealPath.toLowerCase() === isolatedRealPath.toLowerCase()) {
    throw new IsolationPathError("Isolated data directory must not be the official data directory");
  }

  return {
    dataDirectory: isolatedRealPath,
    isolated: true,
    remainingArguments
  };
}
