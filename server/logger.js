
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

function getCallerLocation() {
  const stack = new Error().stack?.split("\n") ?? [];

  // Las primeras líneas corresponden al logger.
  for (const entry of stack.slice(2)) {
    const match = entry.match(
      /^\s*at (?:(?:.+?) \()?(.+?):(\d+):(\d+)\)?$/
    );

    if (!match) continue;

    const [, file, line] = match;

    if (!file.startsWith("file://")) continue;

    const absolutePath = fileURLToPath(file);
    const relativePath = path
      .relative(ROOT_DIR, absolutePath)
      .split(path.sep)
      .join("/");

    if (relativePath === "server/logger.js") continue;

    return `${relativePath}:${line}`;
  }

  return "unknown:0";
}

function write(level, message) {
  const location = getCallerLocation();
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
  info(message) {
    write("INFO", message);
  },

  warn(message) {
    write("WARN", message);
  },

  error(message) {
    write("ERROR", message);
  },

  debug(message) {
    if (process.env.LOG_LEVEL === "debug") {
      write("DEBUG", message);
    }
  }
};
