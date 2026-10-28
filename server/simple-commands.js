
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "./logger.js";
import { getPanelConfig } from "./panel-config.js";

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

function normalizeChannel(channel) {
  return String(channel || "")
    .replace(/^#/, "")
    .trim()
    .toLowerCase();
}

function getValidCommands(data) {
  if (!Array.isArray(data?.commands)) {
    return [];
  }

  return data.commands.filter((item) => {
    const valid =
      typeof item.command === "string" &&
      typeof item.response === "string" &&
      typeof item.enabled === "boolean" &&
      Array.isArray(item.channels);

    if (!valid) {
      logger.warn(
        `Comando simple ignorado por configuración inválida: ${
          item?.command || "sin nombre"
        }`
      );
    }

    return valid;
  });
}

async function loadCommandsFromFile() {
  const content = await readFile(COMMANDS_FILE, "utf8");
  const data = JSON.parse(content);

  if (!Array.isArray(data.commands)) {
    throw new Error('El archivo debe contener una lista "commands".');
  }

  return getValidCommands(data);
}

export async function loadSimpleCommands() {
  try {
    const panelConfig = getPanelConfig("simple");

    // Si Firebase ya tiene comandos, usar esa configuración.
    if (Array.isArray(panelConfig?.items)) {
      commands = getValidCommands({
        commands: panelConfig.items
      });

      logger.info(
        `Comandos simples cargados desde Firebase: ${commands.length}`
      );

      return commands.length;
    }

    // Si Firebase todavía no tiene datos, usar el JSON existente.
    commands = await loadCommandsFromFile();

    logger.info(
      `Comandos simples cargados desde el archivo JSON: ${commands.length}`
    );

    return commands.length;
  } catch (error) {
    logger.error(
      `No se pudieron cargar los comandos simples: ${error.message}`
    );

    commands = [];
    return 0;
  }
}

export async function handleSimpleCommand(context) {
  const panelConfig = getPanelConfig("simple");

  // Consultar Firebase en cada mensaje para usar los cambios recientes.
  if (Array.isArray(panelConfig?.items)) {
    commands = getValidCommands({
      commands: panelConfig.items
    });
  }

  const message = context.message.trim();
  const firstWord = message.split(/\s+/)[0].toLowerCase();

  const command = commands.find(
    (item) => item.command.toLowerCase() === firstWord
  );

  if (!command || !command.enabled) {
    return false;
  }

  const channel = normalizeChannel(context.channelName);

  const allowedChannels = command.channels.some(
    (name) => normalizeChannel(name) === channel
  );

  if (!allowedChannels) {
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
