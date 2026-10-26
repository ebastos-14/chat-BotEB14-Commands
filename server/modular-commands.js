
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { logger } from "./logger.js";

const ROOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const MODULES_DIR = path.join(ROOT_DIR, "commands", "modular");

let modules = [];

export async function loadModularCommands() {
  try {
    const entries = await readdir(MODULES_DIR, {
      withFileTypes: true
    });

    const loaded = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".js")) continue;

      const modulePath = path.join(MODULES_DIR, entry.name);

      try {
        const imported = await import(
          `${pathToFileURL(modulePath).href}?v=${Date.now()}`
        );

        const commandModule = imported.default;

        if (
          !commandModule ||
          typeof commandModule.name !== "string" ||
          typeof commandModule.handleMessage !== "function"
        ) {
          logger.warn(
            `Módulo ignorado: ${entry.name}. Se requieren name y handleMessage().`
          );
          continue;
        }

        loaded.push(commandModule);
        logger.info(`Módulo avanzado cargado: ${commandModule.name}`);
      } catch (error) {
        logger.error(
          `Error al cargar ${entry.name}: ${error.message}`
        );
      }
    }

    modules = loaded;
    logger.info(`Módulos avanzados cargados: ${modules.length}`);

    return modules.length;
  } catch (error) {
    logger.error(
      `No se pudo leer commands/modular: ${error.message}`
    );
    modules = [];
    return 0;
  }
}


export async function handleModularCommand(context) {
  for (const commandModule of modules) {
    try {
      const handled = await commandModule.handleMessage(context);

      if (handled === true) {
        return true;
      }
    } catch (error) {
      logger.error(
        `Error en el módulo ${commandModule.name}: ${error.message}`
      );
    }
  }

  return false;
}

