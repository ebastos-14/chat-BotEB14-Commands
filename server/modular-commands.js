
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { logger } from "./logger.js";

const MODULES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../commands/modular"
);

let modules = [];

export async function loadModularCommands() {
  modules = [];

  let entries;

  try {
    entries = await readdir(MODULES_DIR, { withFileTypes: true });
  } catch (error) {
    if (error.code !== "ENOENT") {
      logger.error(`No se pudieron leer los módulos: ${error.message}`);
    }

    return 0;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".js")) {
      continue;
    }

    const modulePath = path.join(MODULES_DIR, entry.name);

    try {
      const imported = await import(
        `${pathToFileURL(modulePath).href}?update=${Date.now()}`
      );

      const commandModule = imported.default;

      if (
        !commandModule ||
        typeof commandModule.name !== "string" ||
        typeof commandModule.handleMessage !== "function"
      ) {
        logger.warn(`Módulo "${entry.name}" ignorado: configuración inválida.`);
        continue;
      }

      modules.push(commandModule);
      logger.info(`Módulo modular cargado: ${commandModule.name}`);
    } catch (error) {
      logger.error(`Error al cargar "${entry.name}": ${error.message}`);
    }
  }

  logger.info(`Total de módulos modulares cargados: ${modules.length}`);
  return modules.length;
}

export async function handleModularCommand(context) {
  for (const commandModule of modules) {
    if (commandModule.enabled === false) continue;

    const allowedChannels = Array.isArray(commandModule.channels)
      ? commandModule.channels.map(channel =>
          channel.replace(/^#/, "").trim().toLowerCase()
        )
      : [];

    if (!allowedChannels.includes(context.channelName)) {
      continue;
    }

    try {
      const handled = await commandModule.handleMessage(context);

      if (handled === true) {
        return true;
      }
    } catch (error) {
      logger.error(
        `Error en el módulo "${commandModule.name}": ${error.message}`
      );
    }
  }

  return false;
}
