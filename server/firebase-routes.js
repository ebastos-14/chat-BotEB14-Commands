
import express from "express";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase-admin.js";

const router = express.Router();

const ALLOWED_SECTIONS = new Set([
  "simple",
  "category",
  "modular",
  "channels",
]);

// Verificar que la solicitud viene de una sesión autorizada.
router.use(async (req, res, next) => {
  try {
    const authorization = req.headers.authorization || "";
    const match = authorization.match(/^Bearer (.+)$/);

    if (!match) {
      return res.status(401).json({
        error: "Debes iniciar sesión.",
      });
    }

    const decoded = await getAuth().verifyIdToken(match[1]);

    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const userEmail = decoded.email?.trim().toLowerCase();

    if (
      !adminEmail ||
      !userEmail ||
      userEmail !== adminEmail ||
      decoded.email_verified !== true
    ) {
      return res.status(403).json({
        error: "No tienes permiso para administrar este panel.",
      });
    }

    next();
  } catch {
    return res.status(401).json({
      error: "La sesión no es válida o ha caducado.",
    });
  }
});

// Leer la configuración guardada.
router.get("/config/:section", async (req, res) => {
  try {
    const { section } = req.params;

    if (!ALLOWED_SECTIONS.has(section)) {
      return res.status(400).json({
        error: "Sección no válida.",
      });
    }

    const snapshot = await db
      .collection("panelConfig")
      .doc(section)
      .get();

    res.json({
      section,
      data: snapshot.exists ? snapshot.data().data : null,
    });
  } catch (error) {
    console.error("[Firebase API] Error leyendo configuración:", error);
    res.status(500).json({
      error: "No se pudo leer la configuración.",
    });
  }
});

// Guardar la configuración en Firestore.
router.put("/config/:section", async (req, res) => {
  try {
    const { section } = req.params;

    if (!ALLOWED_SECTIONS.has(section)) {
      return res.status(400).json({
        error: "Sección no válida.",
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
        error: "El campo data debe ser un objeto JSON.",
      });
    }

    const serialized = JSON.stringify(data);

    if (Buffer.byteLength(serialized, "utf8") > 700_000) {
      return res.status(413).json({
        error: "La configuración es demasiado grande.",
      });
    }

    await db.collection("panelConfig").doc(section).set({
      data,
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.json({
      success: true,
      section,
    });
  } catch (error) {
    console.error("[Firebase API] Error guardando configuración:", error);
    res.status(500).json({
      error: "No se pudo guardar la configuración.",
    });
  }
});

export default router;
