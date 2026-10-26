
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { logger } from "./logger.js";

const MODULES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../modules"
);

export async function loadModules() {
  let entries;

  try {
    entries = await readdir(MODULES_DIR, {
      withFileTypes: true
    });
  } catch (error) {
    logger.error(
      `No se pudo leer la carpeta de módulos: ${error.message}`
    );
    return [];
  }

  const modules = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const modulePath = path.join(
      MODULES_DIR,
      entry.name,
      "index.js"
    );

    try {
      const imported = await import(
        pathToFileURL(modulePath).href
      );

      const module = imported.default;

      if (
        !module ||
        typeof module.name !== "string" ||
        typeof module.handleMessage !== "function"
      ) {
        logger.warn(
          `Módulo "${entry.name}" ignorado: falta name o handleMessage`
        );
        continue;
      }

      modules.push(module);
      logger.info(`Módulo cargado: ${module.name}`);
    } catch (error) {
      logger.error(
        `Error al cargar "${entry.name}": ${error.message}`
      );
    }
  }

  logger.info(`Total de módulos cargados: ${modules.length}`);

  return modules;
}
