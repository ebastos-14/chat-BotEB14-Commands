
import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from
  "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

// 1. CONFIGURACIÓN DE FIREBASE
// Sustituye los cuatro valores por los de tu aplicación web.

const firebaseConfig = {
  apiKey: "AIzaSyBnGmX_0p-1kcBWRXPh3cDZXRzloz98IVw",
  authDomain: "chat-boteb14-commands.firebaseapp.com",
  projectId: "chat-boteb14-commands",
  appId: "1:265530804480:web:e2f30ecb97b6e920facbe5"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const provider = new GoogleAuthProvider();

// 2. ESTADO DEL PANEL

let channels = [];
let commands = [];

let currentTab = "simple";
let editingId = null;
let nextCommandId = 1;
let loading = false;

const $ = id => document.getElementById(id);

// 3. INICIO DE SESIÓN

const loginButton = $("loginButton");
const logoutButton = $("logoutButton");
const authStatus = $("authStatus");

loginButton.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("[Auth] Error iniciando sesión:", error);
    setStatus("No se pudo iniciar sesión con Google.");
  }
});

logoutButton.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("[Auth] Error cerrando sesión:", error);
    setStatus("No se pudo cerrar la sesión.");
  }
});

function setStatus(message) {
  if (authStatus) {
    authStatus.textContent = message;
  }
}

// 4. COMUNICACIÓN SEGURA CON EL SERVIDOR

async function apiRequest(path, options = {}) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Debes iniciar sesión primero.");
  }

  const token = await user.getIdToken();

  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...options.headers,
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      result.error || `Error HTTP ${response.status}`
    );
  }

  return result;
}

// 5. LEER Y GUARDAR CONFIGURACIÓN EN FIRESTORE

async function readSection(section) {
  const result = await apiRequest(`/config/${section}`);

  return Array.isArray(result.data?.items)
    ? result.data.items
    : [];
}

async function saveSection(section, items) {
  return apiRequest(`/config/${section}`, {
    method: "PUT",
    body: JSON.stringify({
      data: { items }
    })
  });
}

async function loadAllData() {
  loading = true;
  updateControls();

  try {
    const [
      savedChannels,
      simpleCommands,
      categoryCommands,
      modularCommands
    ] = await Promise.all([
      readSection("channels"),
      readSection("simple"),
      readSection("category"),
      readSection("modular")
    ]);

    channels = savedChannels
      .filter(channel =>
        channel &&
        typeof channel.id === "string" &&
        typeof channel.name === "string"
      );

    commands = [
      ...simpleCommands.map(command => ({
        ...command,
        type: "simple"
      })),
      ...categoryCommands.map(command => ({
        ...command,
        type: "categoria"
      })),
      ...modularCommands.map(command => ({
        ...command,
        type: "modular"
      }))
    ].filter(command =>
      command &&
      typeof command.name === "string" &&
      Array.isArray(command.channels)
    );

    nextCommandId = Math.max(
      Date.now(),
      ...commands.map(command => Number(command.id) || 0)
    ) + 1;

    renderChannels();
    renderCommands();

    setStatus("Sesión autorizada. Configuración cargada.");
  } catch (error) {
    console.error("[Panel] Error cargando datos:", error);

    setStatus(
      `No se pudo cargar la configuración: ${error.message}`
    );
  } finally {
    loading = false;
    updateControls();
  }
}

function updateControls() {
  const signedIn = Boolean(auth.currentUser);

  if (loginButton) loginButton.hidden = signedIn;
  if (logoutButton) logoutButton.hidden = !signedIn;

  document.querySelectorAll(
    "#manageChannels, #addCommand"
  ).forEach(button => {
    button.disabled = !signedIn || loading;
  });
}

// 6. AUTENTICACIÓN Y CARGA INICIAL

onAuthStateChanged(auth, async user => {
  updateControls();

  if (!user) {
    channels = [];
    commands = [];

    renderChannels();
    renderCommands();

    setStatus("Inicia sesión con Google para administrar el panel.");
    return;
  }

  setStatus(`Verificando acceso: ${user.email || "usuario"}`);

  await loadAllData();
});

// 7. UTILIDADES DE PRESENTACIÓN

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function channelName(id) {
  return channels.find(channel => channel.id === id)?.name || id;
}

function sectionForType(type) {
  if (type === "categoria") return "category";
  return type;
}

function renderChannels() {
  const channelList = $("channelList");
  const editorChannels = $("editorChannels");

  if (channelList) {
    channelList.innerHTML = channels.map(channel => `
      <div class="channel-choice">
        <span>
          ${escapeHTML(channel.name)}
          <span class="notice">(${escapeHTML(channel.id)})</span>
        </span>
        <button
          type="button"
          data-remove-channel="${escapeHTML(channel.id)}"
          ${loading ? "disabled" : ""}
        >×</button>
      </div>
    `).join("") ||
      '<p class="empty">No hay canales registrados.</p>';
  }

  if (editorChannels) {
    editorChannels.innerHTML = channels.map(channel => `
      <label class="channel-choice">
        <input
          type="checkbox"
          name="editorChannel"
          value="${escapeHTML(channel.id)}"
        >
        ${escapeHTML(channel.name)}
        <span class="notice">(${escapeHTML(channel.id)})</span>
      </label>
    `).join("") ||
      '<p class="empty">Agrega canales primero.</p>';
  }
}

function renderCommands() {
  const commandList = $("commandList");
  if (!commandList) return;

  const visible = commands.filter(
    command => command.type === currentTab
  );

  commandList.innerHTML = visible.map(command => `
    <article class="command">
      <div class="command-head">
        <div>
          <div class="command-name">
            ${escapeHTML(command.name)}
          </div>
          <div class="channels">
            ${
              command.channels.length
                ? command.channels.map(id =>
                    escapeHTML(channelName(id))
                  ).join(", ")
                : "Sin canales asignados"
            }
          </div>
        </div>

        <div class="state mod-state ${command.mod ? "" : "off"}">
          ${command.mod ? "✓ Mod" : "— Mod"}
        </div>

        <div class="state active-state ${command.active ? "" : "off"}">
          ${command.active ? "✓ Activo" : "✕ Inactivo"}
        </div>

        <button
          type="button"
          class="edit"
          data-edit="${escapeHTML(command.id)}"
          aria-label="Editar comando"
          ${loading ? "disabled" : ""}
        >✎</button>
      </div>

      <div class="response">
        ${
          escapeHTML(command.response || "") ||
          '<span class="notice">Sin respuesta configurada</span>'
        }
      </div>
    </article>
  `).join("") ||
    '<div class="empty">No hay comandos guardados en esta sección.</div>';
}

// 8. EDITOR DE COMANDOS

function openEditor(id = null) {
  if (!auth.currentUser || loading) return;

  editingId = id;

  const command = commands.find(
    item => String(item.id) === String(id)
  );

  $("editorTitle").textContent =
    command ? "Editar comando" : "Nuevo comando";

  $("commandName").value = command?.name || "!";
  $("commandMod").checked = command?.mod || false;
  $("commandActive").checked =
    command ? command.active !== false : true;
  $("commandResponse").value = command?.response || "";

  renderChannels();

  document.querySelectorAll(
    '[name="editorChannel"]'
  ).forEach(input => {
    input.checked = Boolean(
      command?.channels.includes(input.value)
    );
  });

  $("editorOverlay").classList.add("open");
  $("commandName").focus();
}

function closeEditor() {
  $("editorOverlay").classList.remove("open");
  editingId = null;
}

document.querySelectorAll("[data-tab]").forEach(button => {
  button.addEventListener("click", () => {
    currentTab = button.dataset.tab;
    document.querySelectorAll("[data-tab]").forEach(tab => {
      tab.classList.toggle("selected", tab === button);
    });

    renderCommands();
  });
});

$("manageChannels").addEventListener("click", () => {
  if (!auth.currentUser || loading) return;

  $("channelManager").hidden = !$("channelManager").hidden;

  if (!$("channelManager").hidden) {
    $("channelManager").scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }
});

$("addCommand").addEventListener("click", () => openEditor());

$("closeEditor").addEventListener("click", closeEditor);
$("cancelEditor").addEventListener("click", closeEditor);

$("editorOverlay").addEventListener("click", event => {
  if (event.target === $("editorOverlay")) closeEditor();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeEditor();
});

// 9. GESTIÓN PERSISTENTE DE CANALES

$("channelForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!auth.currentUser || loading) return;

  const id = $("newChannel").value
    .trim()
    .replace(/^@/, "")
    .toLowerCase();

  if (!/^[a-z0-9_]{1,25}$/.test(id)) {
    alert("Escribe un nombre de canal de Twitch válido.");
    return;
  }

  if (channels.some(channel => channel.id === id)) {
    alert("Ese canal ya está registrado.");
    return;
  }

  const updatedChannels = [...channels, { id, name: id }];

  loading = true;
  updateControls();

  try {
    await saveSection("channels", updatedChannels);

    channels = updatedChannels;
    $("newChannel").value = "";

    renderChannels();
    renderCommands();

    setStatus("Canal guardado correctamente.");
  } catch (error) {
    console.error("[Panel] Error guardando canal:", error);
    alert(`No se pudo guardar el canal: ${error.message}`);
  } finally {
    loading = false;
    updateControls();
    renderChannels();
    renderCommands();
  }
});

$("channelList").addEventListener("click", async event => {
  const button = event.target.closest("[data-remove-channel]");
  if (!button || !auth.currentUser || loading) return;

  const id = button.dataset.removeChannel;

  if (!confirm(`¿Retirar ${id} de los canales disponibles?`)) {
    return;
  }

  const updatedChannels = channels.filter(
    channel => channel.id !== id
  );

  const updatedCommands = commands.map(command => ({
    ...command,
    channels: command.channels.filter(
      channelId => channelId !== id
    )
  }));

  loading = true;
  updateControls();

  try {
    // Guardar los canales y los comandos afectados.
    await saveSection("channels", updatedChannels);

    for (const section of ["simple", "category", "modular"]) {
      const sectionCommands = updatedCommands
        .filter(command => sectionForType(command.type) === section)
        .map(({ type, ...command }) => command);

      await saveSection(section, sectionCommands);
    }

    channels = updatedChannels;
    commands = updatedCommands;

    renderChannels();
    renderCommands();

    setStatus("Canal retirado y configuración actualizada.");
  } catch (error) {
    console.error("[Panel] Error retirando canal:", error);
    alert(`No se pudo completar la operación: ${error.message}`);

    await loadAllData();
  } finally {
    loading = false;
    updateControls();
    renderChannels();
    renderCommands();
  }
});

// 10. EDITAR Y GUARDAR COMANDOS EN FIRESTORE

$("commandList").addEventListener("click", event => {
  const button = event.target.closest("[data-edit]");
  if (button) openEditor(button.dataset.edit);
});

$("editorForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!auth.currentUser || loading) return;

  const name = $("commandName").value.trim().toLowerCase();

  if (!/^![a-z0-9_]+$/.test(name)) {
    alert("El comando debe comenzar con ! y usar letras, números o _.");
    return;
  }

  const duplicate = commands.some(command =>
    command.type === currentTab &&
    command.name.toLowerCase() === name &&
    String(command.id) !== String(editingId)
  );

  if (duplicate) {
    alert("Ya existe ese comando en esta categoría.");
    return;
  }

  const selectedChannels = [
    ...document.querySelectorAll(
      '[name="editorChannel"]:checked'
    )
  ].map(input => input.value);

  const data = {
    id: editingId ?? nextCommandId++,
    name,
    channels: selectedChannels,
    mod: $("commandMod").checked,
    active: $("commandActive").checked,
    response: $("commandResponse").value.trim()
  };

  const previousCommands = [...commands];

  const updatedCommands = editingId !== null
    ? commands.map(command =>
        String(command.id) === String(editingId)
          ? { ...command, ...data, type: currentTab }
          : command
      )
    : [...commands, { ...data, type: currentTab }];

  const section = sectionForType(currentTab);

  const sectionCommands = updatedCommands
    .filter(command => sectionForType(command.type) === section)
    .map(({ type, ...command }) => command);

  loading = true;
  updateControls();

  try {
    await saveSection(section, sectionCommands);

    commands = updatedCommands;

    closeEditor();
    renderCommands();

    setStatus("Comando guardado en Firestore.");
  } catch (error) {
    commands = previousCommands;

    console.error("[Panel] Error guardando comando:", error);
    alert(`No se pudo guardar el comando: ${error.message}`);

    renderCommands();
  } finally {
    loading = false;
    updateControls();
  }
});

// 11. RENDER INICIAL SIN DATOS FICTICIOS

renderChannels();
renderCommands();
