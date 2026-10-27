
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!rawCredentials) {
  throw new Error("Falta FIREBASE_SERVICE_ACCOUNT en las variables de entorno.");
}

let credentials;

try {
  credentials = JSON.parse(rawCredentials);
} catch {
  throw new Error("FIREBASE_SERVICE_ACCOUNT no contiene un JSON válido.");
}

const firebaseApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert(credentials),
      });

export const db = getFirestore(firebaseApp);
