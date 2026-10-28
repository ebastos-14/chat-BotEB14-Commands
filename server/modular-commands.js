
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { logger } from "./logger.js";
import { getPanelConfig } from "./panel-config.js";

const MODULES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../commands/modular"
);

let modules = [];

function normalizeChannel(channel) {
  return String(channel ?? "")
    .replace(/^#/, "")
    .trim()
    .toLowerCase();
}

function getPanelModuleConfig(moduleName) {
  const panelConfig = getPanelConfig("modular");
  const items = Array.isArray(panelConfig?.items)
    ? panelConfig.items
    : [];

  return items.find(item => {
    const name = String(item.name ?? item.command ?? "")
      .trim()
      .toLowerCase();

    return name === moduleName.trim().toLowerCase();
  });
}

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
        logger.warn(
          `Módulo "${entry.name}" ignorado: configuración inválida.`
        );
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
  const channelName = normalizeChannel(context.channelName);

  for (const commandModule of modules) {
    const panelModule = getPanelModuleConfig(commandModule.name);

    // Si existe configuración en el panel, esta tiene prioridad.
    // Si no existe, se conserva la configuración original del módulo.
    const isEnabled = panelModule
      ? panelModule.active !== false
      : commandModule.enabled !== false;

    if (!isEnabled) {
      continue;
    }

    const configuredChannels = panelModule
      ? panelModule.channels
      : commandModule.channels;

    const allowedChannels = Array.isArray(configuredChannels)
      ? configuredChannels.map(normalizeChannel)
      : [];

    if (!allowedChannels.includes(channelName)) {
      continue;
    }

    // "mod" es el campo que utiliza actualmente el panel para NeedMod.
    const moderatorsOnly = panelModule
      ? panelModule.mod === true
      : commandModule.mod === true ||
        commandModule.needMod === true;

    if (
      moderatorsOnly &&
      context.isMod !== true &&
      context.isBroadcaster !== true
    ) {
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
