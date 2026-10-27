import { getChannelCategory } from "./twitch-api.js";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import tmi from "tmi.js";
import { db } from "./firebase-admin.js";
import firebaseRoutes from "./firebase-routes.js";

import {
  initializePanelConfig,
  watchPanelConfig
} from "./panel-config.js";


import { config, validateChatConfig } from "./hub.js";
import { logger } from "./logger.js";
import {
  loadSimpleCommands,
  handleSimpleCommand
} from "./simple-commands.js";
import {
  loadCategoryCommands,
  handleCategoryCommand
} from "./category-commands.js";
import {
  loadModularCommands,
  handleModularCommand
} from "./modular-commands.js";

const app = express();

app.disable("x-powered-by");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDirectory = path.resolve(__dirname, "../public");

// Middleware
app.use(express.json());

// Servir HTML, CSS, JavaScript y demás archivos de public/
app.use(express.static(publicDirectory));

// Rutas de Firebase para el panel de administración
app.use("/api", firebaseRoutes);

// Página principal: panel de administración
app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDirectory, "index.html"));
});

// Endpoint de comprobación de Render
app.get("/loader", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "chat-BotEB14-commands",
    uptime: Math.floor(process.uptime())
  });
});

// Iniciar servidor web
const server = app.listen(config.port, "0.0.0.0", () => {
  logger.info(`Servidor web iniciado en el puerto ${config.port}`);
});

// Comprobar conexión con Firestore
db.listCollections()
  .then(() => {
    logger.info("[FIREBASE] Conexión con Firestore correcta.");
  })
  .catch((error) => {
    logger.error(`[FIREBASE] Error de conexión: ${error.message}`);
  });

let client;
let shuttingDown = false;

async function handleChatMessage(channel, tags, message, self) {
  if (self || !message.trim()) return;

  const channelName = channel.replace(/^#/, "").toLowerCase();

  const context = {
    channel,
    channelName,
    username: tags.username || "",
    displayName: tags["display-name"] || tags.username || "",
    userId: tags["user-id"] || "",
    message,
    tags,
    isMod: tags.mod === true,
    isBroadcaster: tags.badges?.broadcaster === "1",
    category: "",
    reply: (response) => client.say(channel, response)
  };

  try {
    if (await handleSimpleCommand(context)) return;

    const usedCommand = message.trim().split(/\s+/)[0].toLowerCase();

    if (usedCommand === "!drops") {
      context.category = await getChannelCategory(channelName);
    }

    if (await handleCategoryCommand(context)) return;

    await handleModularCommand(context);
  } catch (error) {
    logger.error(
      `Error procesando mensaje en #${channelName}: ${error.message}`
    );
  }
}


async function startBot() {
  await initializePanelConfig();
  watchPanelConfig();

  await loadSimpleCommands();
  await loadCategoryCommands();
  await loadModularCommands();


  if (!validateChatConfig()) {
    logger.warn(
      "El servidor web sigue activo, pero el bot de Twitch no se conectará hasta configurar las variables necesarias."
    );
    return;
  }

  client = new tmi.Client({
    options: {
      debug: false
    },
    connection: {
      reconnect: true,
      secure: true
    },
    identity: {
      username: config.twitch.username,
      password: config.twitch.oauth
    },
    channels: config.twitch.channels
  });

  client.on("connected", (address, port) => {
    logger.info(`Bot conectado a Twitch: ${address}:${port}`);
  });

  client.on("disconnected", (reason) => {
    logger.warn(
      `Bot desconectado de Twitch: ${reason || "sin detalle"}`
    );
  });

  client.on("message", handleChatMessage);

  try {
    await client.connect();
  } catch (error) {
    logger.error(`No se pudo conectar a Twitch: ${error.message}`);
  }
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`Recibida señal ${signal}; cerrando servicios...`);

  try {
    if (client) await client.disconnect();
  } catch (error) {
    logger.warn(`Error cerrando Twitch: ${error.message}`);
  }

  server.close(() => {
    logger.info("Servidor web cerrado.");
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

startBot().catch((error) => {
  logger.error(`Error al iniciar el bot: ${error.message}`);
});
