
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "./logger.js";

const ROOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const COMMANDS_FILE = path.join(
  ROOT_DIR,
  "commands",
  "simple",
  "commands.json"
);

let commands = [];

export async function loadSimpleCommands() {
  try {
    const content = await readFile(COMMANDS_FILE, "utf8");
    const data = JSON.parse(content);

    if (!Array.isArray(data.commands)) {
      throw new Error('El archivo debe contener una lista "commands".');
    }

    commands = data.commands.filter((item) => {
      const valid =
        typeof item.command === "string" &&
        typeof item.response === "string" &&
        typeof item.enabled === "boolean" &&
        Array.isArray(item.channels);

      if (!valid) {
        logger.warn(
          `Comando simple ignorado por configuración inválida: ${
            item.command || "sin nombre"
          }`
        );
      }

      return valid;
    });

    logger.info(`Comandos simples cargados: ${commands.length}`);
    return commands.length;
  } catch (error) {
    logger.error(`No se pudieron cargar los comandos simples: ${error.message}`);
    commands = [];
    return 0;
  }
}

export async function handleSimpleCommand(context) {
  const message = context.message.trim();
  const command = commands.find(
    (item) => item.command.toLowerCase() === message.split(/\s+/)[0].toLowerCase()
  );

  if (!command || !command.enabled) return false;

  const channel = context.channelName.toLowerCase();

  if (!command.channels.some((name) => name.replace(/^#/, "").toLowerCase() === channel)) {
    return false;
  }

  if (
    command.permissions?.moderatorOnly === true &&
    !context.isMod &&
    !context.isBroadcaster
  ) {
    return false;
  }

  await context.reply(command.response);
  return true;
}
