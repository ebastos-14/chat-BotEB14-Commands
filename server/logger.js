
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

function getLocation(metaUrl) {
  if (!metaUrl) {
    return "unknown:0";
  }

  const filePath = fileURLToPath(metaUrl);
  const relativePath = path
    .relative(ROOT_DIR, filePath)
    .split(path.sep)
    .join("/");

  return relativePath;
}

function write(level, message, metaUrl, line) {
  const location = `${getLocation(metaUrl)}:${line ?? 0}`;
  const label = level.padEnd(5, " ");

  const output = `[${label}] [${location}] ${message}`;

  if (level === "ERROR") {
    console.error(output);
  } else if (level === "WARN") {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  info(message, metaUrl, line) {
    write("INFO", message, metaUrl, line);
  },

  warn(message, metaUrl, line) {
    write("WARN", message, metaUrl, line);
  },

  error(message, metaUrl, line) {
    write("ERROR", message, metaUrl, line);
  },

  debug(message, metaUrl, line) {
    if (process.env.LOG_LEVEL === "debug") {
      write("DEBUG", message, metaUrl, line);
    }
  }
};
