
import { db } from "./firebase-admin.js";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SERVER_DIR, "..");
const SIMPLE_FILE = path.join(ROOT_DIR, "commands/simple/commands.json");
const CATEGORY_FILE = path.join(ROOT_DIR, "commands/category/commands.json");
const MODULAR_DIR = path.join(ROOT_DIR, "commands/modular");

const SECTIONS = ["simple", "category", "modular", "channels"];

const cache = {
  simple: null,
  category: null,
  modular: null,
  channels: null,
};

const listeners = new Map();

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function normalizeChannel(value) {
  return String(value ?? "").replace(/^#/, "").trim().toLowerCase();
}

async function readCommandsFile(file) {
  try {
    const content = await readFile(file, "utf8");
    const parsed = JSON.parse(content);
    return Array.isArray(parsed.commands) ? parsed.commands : [];
  } catch (error) {
    console.error(
      `[PanelConfig] No se pudo leer ${path.basename(file)}:`,
      error.message
    );
    return [];
  }
}

function normalizeSimple(command, index) {
  const name = String(command.command ?? command.name ?? "").trim();
  if (!name) return null;

  return {
    id: command.id ?? `simple-${index}-${name}`,
    name,
    command: name,
    active: command.active ?? command.enabled ?? true,
    enabled: command.active ?? command.enabled ?? true,
    mod: command.mod ?? command.permissions?.moderatorOnly ?? false,
    channels: Array.isArray(command.channels)
      ? command.channels.map(normalizeChannel)
      : [],
    response: String(command.response ?? ""),
  };
}

function normalizeCategory(command, index) {
  const name = String(command.command ?? command.name ?? "").trim();
  if (!name) return null;

  return {
    id: command.id ?? `category-${index}-${name}`,
    name,
    command: name,
    active: command.active ?? command.enabled ?? true,
    enabled: command.active ?? command.enabled ?? true,
    mod: command.mod ?? command.permissions?.moderatorOnly ?? false,
    channels: Array.isArray(command.channels)
      ? command.channels.map(normalizeChannel)
      : [],
    conditions: Array.isArray(command.conditions)
      ? command.conditions
          .filter(item => item && typeof item.category === "string")
          .map(item => ({
            category: item.category,
            response: String(item.response ?? ""),
          }))
      : [],
    defaultResponse: String(command.defaultResponse ?? ""),
    response: String(command.defaultResponse ?? ""),
  };
}

async function readModularCommands() {
  let entries;

  try {
    entries = await readdir(MODULAR_DIR, { withFileTypes: true });
  } catch (error) {
    console.error("[PanelConfig] No se pudo leer la carpeta modular:", error.message);
    return [];
  }

  const result = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".js")) continue;

    try {
      const file = path.join(MODULAR_DIR, entry.name);
      const imported = await import(
        `${pathToFileURL(file).href}?panelSeed=${Date.now()}`
      );
      const module = imported.default;

      if (!module || typeof module.name !== "string") continue;

      result.push({
        id: `modular-${module.name}`,
        name: module.name,
        active: module.enabled !== false,
        mod: module.mod === true || module.needMod === true,
        channels: Array.isArray(module.channels)
          ? module.channels.map(normalizeChannel)
          : [],
      });
    } catch (error) {
      console.error(
        `[PanelConfig] No se pudo descubrir ${entry.name}:`,
        error.message
      );
    }
  }

  return result;
}

function validItems(data, section) {
  if (!Array.isArray(data?.items) || data.items.length === 0) {
    return false;
  }

  if (section === "channels") {
    return data.items.every(
      item => item && typeof item.id === "string" && typeof item.name === "string"
    );
  }

  if (section === "modular") {
    return data.items.every(
      item => item && typeof item.name === "string" && Array.isArray(item.channels)
    );
  }

  return data.items.every(
    item =>
      item &&
      typeof (item.name ?? item.command) === "string" &&
      Array.isArray(item.channels)
  );
}

async function buildInitialConfig() {
  const simple = (await readCommandsFile(SIMPLE_FILE))
    .map(normalizeSimple)
    .filter(Boolean);

  const category = (await readCommandsFile(CATEGORY_FILE))
    .map(normalizeCategory)
    .filter(Boolean);

  const modular = await readModularCommands();

  const channelMap = new Map();

  for (const command of [...simple, ...category, ...modular]) {
    for (const id of command.channels) {
      if (id) channelMap.set(id, { id, name: id });
    }
  }

  return {
    simple: { items: simple },
    category: { items: category },
    modular: { items: modular },
    channels: { items: [...channelMap.values()] },
  };
}

export function getPanelConfig(section) {
  if (!SECTIONS.includes(section)) {
    throw new Error(`Sección no válida: ${section}`);
  }

  return clone(cache[section]);
}

export async function initializePanelConfig() {
  const defaults = await buildInitialConfig();

  for (const section of SECTIONS) {
    const reference = db.collection("panelConfig").doc(section);
    const snapshot = await reference.get();
    const savedData = snapshot.exists ? snapshot.data()?.data : null;

    // Solo repara secciones vacías o inválidas.
    // Las configuraciones existentes y válidas se conservan.
    if (!validItems(savedData, section) && defaults[section].items.length > 0) {
      console.warn(
        `[PanelConfig] Inicializando sección "${section}" desde los archivos existentes.`
      );

      await reference.set({
        data: defaults[section],
        updatedAt: new Date(),
      });

      cache[section] = clone(defaults[section]);
    } else {
      cache[section] = savedData ?? defaults[section];
    }
  }

  console.info("[PanelConfig] Configuración inicial cargada.");
}

export function watchPanelConfig() {
  for (const section of SECTIONS) {
    if (listeners.has(section)) continue;

    const unsubscribe = db
      .collection("panelConfig")
      .doc(section)
      .onSnapshot(
        snapshot => {
          cache[section] = snapshot.exists
            ? snapshot.data()?.data ?? null
            : null;

          console.info(`[PanelConfig] Sección actualizada: ${section}`);
        },
        error => {
          console.error(
            `[PanelConfig] Error en ${section}:`,
            error.message
          );
        }
      );

    listeners.set(section, unsubscribe);
  }
}

export async function savePanelConfig(section, data) {
  if (!SECTIONS.includes(section)) {
    throw new Error(`Sección no válida: ${section}`);
  }

  await db.collection("panelConfig").doc(section).set({
    data,
    updatedAt: new Date(),
  });

  cache[section] = clone(data);
}

export function stopWatchingPanelConfig() {
  for (const unsubscribe of listeners.values()) {
    unsubscribe();
  }

  listeners.clear();
}
