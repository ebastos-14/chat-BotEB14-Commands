
import "dotenv/config";

function normalizeChannel(channel) {
  return channel.trim().replace(/^#/, "").toLowerCase();
}

function readChannels(value = "") {
  return [...new Set(
    value
      .split(",")
      .map(normalizeChannel)
      .filter(Boolean)
  )];
}

export const config = Object.freeze({
  port: Number(process.env.PORT) || 3000,

  twitch: Object.freeze({
    username: process.env.TWITCH_BOT_USERNAME || "",
    oauth: process.env.TWITCH_OAUTH || "",
    channels: readChannels(process.env.TWITCH_CHANNELS || ""),

    clientId: process.env.TWITCH_CLIENT_ID || "",
    clientSecret: process.env.TWITCH_CLIENT_SECRET || ""
  })
});

export function validateChatConfig() {
  const missing = [];

  if (!config.twitch.username) {
    missing.push("TWITCH_BOT_USERNAME");
  }

  if (!config.twitch.oauth) {
    missing.push("TWITCH_OAUTH");
  }

  if (config.twitch.channels.length === 0) {
    missing.push("TWITCH_CHANNELS");
  }

  if (missing.length > 0) {
    console.error(
      `[CONFIG] Faltan variables de entorno: ${missing.join(", ")}`
    );
    return false;
  }

  if (!config.twitch.oauth.startsWith("oauth:")) {
    console.warn(
      "[CONFIG] TWITCH_OAUTH normalmente debe comenzar con oauth:"
    );
  }

  return true;
}
