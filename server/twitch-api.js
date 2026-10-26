
import { config } from "./hub.js";
import { logger } from "./logger.js";

const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const API_URL = "https://api.twitch.tv/helix";

let appToken = "";
let tokenExpiresAt = 0;
let tokenRequest = null;

const userIdCache = new Map();
const categoryCache = new Map();

const CACHE_DURATION_MS = 60_000;

async function getAppAccessToken() {
  if (appToken && Date.now() < tokenExpiresAt - 60_000) {
    return appToken;
  }

  if (tokenRequest) return tokenRequest;

  tokenRequest = (async () => {
    const { clientId, clientSecret } = config.twitch;

    if (!clientId || !clientSecret) {
      throw new Error(
        "Faltan TWITCH_CLIENT_ID o TWITCH_CLIENT_SECRET."
      );
    }

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials"
      })
    });

    if (!response.ok) {
      throw new Error(
        `Twitch OAuth respondió HTTP ${response.status}.`
      );
    }

    const data = await response.json();

    appToken = data.access_token;
    tokenExpiresAt = Date.now() + data.expires_in * 1000;

    return appToken;
  })();

  try {
    return await tokenRequest;
  } finally {
    tokenRequest = null;
  }
}

async function helixGet(endpoint, params) {
  const token = await getAppAccessToken();
  const url = new URL(`${API_URL}${endpoint}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      "Client-Id": config.twitch.clientId,
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(
      `Twitch API respondió HTTP ${response.status} en ${endpoint}.`
    );
  }

  return response.json();
}

async function getUserId(login) {
  const channel = login.toLowerCase();
  const cached = userIdCache.get(channel);

  if (cached) return cached;

  const result = await helixGet("/users", {
    login: channel
  });

  const user = result.data?.[0];

  if (!user) {
    throw new Error(`No se encontró el canal "${channel}" en Twitch.`);
  }

  userIdCache.set(channel, user.id);
  return user.id;
}

export async function getChannelCategory(channelName) {
  const channel = channelName.replace(/^#/, "").trim().toLowerCase();

  if (!channel) return "";

  const cached = categoryCache.get(channel);

  if (cached && Date.now() < cached.expiresAt) {
    return cached.category;
  }

  try {
    const broadcasterId = await getUserId(channel);

    const result = await helixGet("/channels", {
      broadcaster_id: broadcasterId
    });

    const category = result.data?.[0]?.game_name || "";

    categoryCache.set(channel, {
      category,
      expiresAt: Date.now() + CACHE_DURATION_MS
    });

    return category;
  } catch (error) {
    logger.error(
      `No se pudo consultar la categoría de #${channel}: ${error.message}`
    );

    return "";
  }
}
