
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
  "category",
  "commands.json"
);

let commands = [];

function normalizeChannel(channel = "") {
  return String(channel).replace(/^#/, "").trim().toLowerCase();
}

function getValidCommands(data) {
  if (!Array.isArray(data?.commands)) {
    return [];
  }

  return data.commands.filter((item) => {
    const valid =
      typeof item.command === "string" &&
      typeof item.enabled === "boolean" &&
      Array.isArray(item.channels) &&
      Array.isArray(item.conditions);

    if (!valid) {
      logger.warn(
        `Comando por categoría inválido: ${item?.command || "sin nombre"}`
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

export async function loadCategoryCommands() {
  try {
    const panelConfig = getPanelConfig("category");

    if (Array.isArray(panelConfig?.items)) {
      commands = getValidCommands({
        commands: panelConfig.items
      });

      logger.info(
        `Comandos por categoría cargados desde Firebase: ${commands.length}`
      );

      return commands.length;
    }

    commands = await loadCommandsFromFile();

    logger.info(
      `Comandos por categoría cargados desde JSON: ${commands.length}`
    );

    return commands.length;
  } catch (error) {
    logger.error(
      `No se pudieron cargar los comandos por categoría: ${error.message}`
    );

    commands = [];
    return 0;
  }
}

export async function handleCategoryCommand(context) {
  const panelConfig = getPanelConfig("category");

  // Consultar la configuración actual al procesar cada mensaje.
  if (Array.isArray(panelConfig?.items)) {
    commands = getValidCommands({
      commands: panelConfig.items
    });
  }

  const message = context.message.trim();
  const usedCommand = message.split(/\s+/)[0].toLowerCase();

  const command = commands.find(
    (item) => item.command.toLowerCase() === usedCommand
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

  const currentCategory = String(context.category || "")
    .trim()
    .toLowerCase();

  const condition = command.conditions.find(
    (item) =>
      typeof item.category === "string" &&
      item.category.trim().toLowerCase() === currentCategory
  );

  const response = condition?.response || command.defaultResponse;

  if (typeof response !== "string" || !response.trim()) {
    logger.warn(
      `Sin respuesta configurada para ${command.command} en categoría "${context.category || "desconocida"}"`
    );

    return false;
  }

  await context.reply(response);
  return true;
}
