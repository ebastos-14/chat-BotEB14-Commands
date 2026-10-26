
export default {
  name: "ping",
  enabled: true,

  channels: ["jaciitv", "ebastos14", "boteb14"],

  async handleMessage(context) {
    const message = context.message.trim().toLowerCase();

    if (message !== "!pingmod") {
      return false;
    }

    await context.reply("¡Pong modular! El módulo funciona correctamente.");
    return true;
  }
};
