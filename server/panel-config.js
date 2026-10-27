
import { db } from "./firebase-admin.js";

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

// Consultar la configuración que el bot tiene en memoria.
export function getPanelConfig(section) {
  if (!SECTIONS.includes(section)) {
    throw new Error(`Sección no válida: ${section}`);
  }

  return clone(cache[section]);
}

// Cargar la configuración existente de Firestore.
export async function initializePanelConfig() {
  for (const section of SECTIONS) {
    const snapshot = await db
      .collection("panelConfig")
      .doc(section)
      .get();

    if (snapshot.exists) {
      cache[section] = snapshot.data()?.data ?? null;
    } else {
      cache[section] = null;
    }
  }

  console.info("[PanelConfig] Configuración inicial cargada.");
}

// Mantener la copia en memoria sincronizada con Firestore.
export function watchPanelConfig() {
  for (const section of SECTIONS) {
    if (listeners.has(section)) continue;

    const unsubscribe = db
      .collection("panelConfig")
      .doc(section)
      .onSnapshot(
        (snapshot) => {
          cache[section] = snapshot.exists
            ? snapshot.data()?.data ?? null
            : null;

          console.info(
            `[PanelConfig] Sección actualizada: ${section}`
          );
        },
        (error) => {
          console.error(
            `[PanelConfig] Error en ${section}:`,
            error.message
          );
        }
      );

    listeners.set(section, unsubscribe);
  }
}

// Guardar y actualizar la copia local inmediatamente.
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
