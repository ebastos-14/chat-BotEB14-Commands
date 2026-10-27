
import express from "express";
import { getAuth } from "firebase-admin/auth";
import { getPanelConfig, savePanelConfig } from "./panel-config.js";

const router = express.Router();

const ALLOWED_SECTIONS = new Set([
  "simple",
  "category",
  "modular",
  "channels"
]);

// Verificar que la persona tenga permiso para administrar el panel.
router.use(async (req, res, next) => {
  try {
    const authorization = req.headers.authorization || "";
    const match = authorization.match(/^Bearer (.+)$/);

    if (!match) {
      return res.status(401).json({
        error: "Debes iniciar sesión."
      });
    }

    const decoded = await getAuth().verifyIdToken(match[1]);

    const adminEmail = process.env.ADMIN_EMAIL
      ?.trim()
      .toLowerCase();

    const userEmail = decoded.email
      ?.trim()
      .toLowerCase();

    if (
      !adminEmail ||
      !userEmail ||
      userEmail !== adminEmail ||
      decoded.email_verified !== true
    ) {
      return res.status(403).json({
        error: "No tienes permiso para administrar este panel."
      });
    }

    next();
  } catch (error) {
    console.error("[FirebaseRoutes] Error de autenticación:", error.message);

    return res.status(401).json({
      error: "La sesión no es válida o ha caducado."
    });
  }
});

// Leer la configuración de una sección.
router.get("/config/:section", async (req, res) => {
  try {
    const { section } = req.params;

    if (!ALLOWED_SECTIONS.has(section)) {
      return res.status(400).json({
        error: "Sección no válida."
      });
    }

    const data = getPanelConfig(section);

    return res.json({
      section,
      data
    });
  } catch (error) {
    console.error("[FirebaseRoutes] Error al leer:", error.message);

    return res.status(500).json({
      error: "No se pudo leer la configuración."
    });
  }
});

// Guardar la configuración en Firebase y actualizar la caché del servidor.
router.put("/config/:section", async (req, res) => {
  try {
    const { section } = req.params;

    if (!ALLOWED_SECTIONS.has(section)) {
      return res.status(400).json({
        error: "Sección no válida."
      });
    }

    const data = req.body?.data;

    if (
      data === undefined ||
      data === null ||
      typeof data !== "object" ||
      Array.isArray(data)
    ) {
      return res.status(400).json({
        error: "El campo data debe ser un objeto JSON."
      });
    }

    const size = Buffer.byteLength(
      JSON.stringify(data),
      "utf8"
    );

    if (size > 700_000) {
      return res.status(413).json({
        error: "La configuración es demasiado grande."
      });
    }

    await savePanelConfig(section, data);

    console.info(
      `[FirebaseRoutes] Sección guardada correctamente: ${section}`
    );

    return res.json({
      success: true,
      section
    });
  } catch (error) {
    console.error("[FirebaseRoutes] Error al guardar:", error.message);

    return res.status(500).json({
      error: "No se pudo guardar la configuración."
    });
  }
});

export default router;
