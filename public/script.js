
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

const firebaseConfig = {
  apiKey: "AIzaSyBnGmX_0p-1kcBWRXPh3cDZXRzloz98IVw",
  authDomain: "chat-boteb14-commands.firebaseapp.com",
  projectId: "chat-boteb14-commands",
  appId: "1:265530804480:web:e2f30ecb97b6e920facbe5"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const provider = new GoogleAuthProvider();

const loginButton = document.getElementById("loginButton");
const logoutButton = document.getElementById("logoutButton");
const authStatus = document.getElementById("authStatus");

loginButton.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    authStatus.textContent = "No se pudo iniciar sesión.";
  }
});

logoutButton.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, (user) => {
  loginButton.hidden = Boolean(user);
  logoutButton.hidden = !user;
  authStatus.textContent = user
    ? `Sesión iniciada: ${user.email}`
    : "No has iniciado sesión.";
});


const channels = [
  { id: "jaciitv", name: "JaciiTV" },
  { id: "ebastos14", name: "EBastos14" },
  { id: "boteb14", name: "BotEB14" }
];

let currentTab = "simple";
let editingId = null;

let commands = [
  {
    id: 1,
    type: "simple",
    name: "!ping",
    channels: ["jaciitv", "ebastos14", "boteb14"],
    mod: false,
    active: true,
    response: "pong"
  },
  {
    id: 2,
    type: "simple",
    name: "!hola",
    channels: ["jaciitv"],
    mod: false,
    active: true,
    response: "¡Hola, chat!"
  },
  {
    id: 3,
    type: "categoria",
    name: "!drops",
    channels: ["jaciitv", "boteb14"],
    mod: false,
    active: true,
    response: "Los enlaces de drops dependen del juego."
  },
  {
    id: 4,
    type: "modular",
    name: "!pingmod",
    channels: ["jaciitv"],
    mod: true,
    active: true,
    response: "¡Pong modular!"
  }
];

const $ = id => document.getElementById(id);

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

function renderChannels() {
  $("channelList").innerHTML = channels.map(channel => `
    <div class="channel-choice">
      <span>${escapeHTML(channel.name)}
        <span class="notice">(${escapeHTML(channel.id)})</span>
      </span>
      <button type="button"
        data-remove-channel="${escapeHTML(channel.id)}">×</button>
    </div>
  `).join("") || '<p class="empty">No hay canales registrados.</p>';

  $("editorChannels").innerHTML = channels.map(channel => `
    <label class="channel-choice">
      <input type="checkbox" name="editorChannel"
        value="${escapeHTML(channel.id)}">
      ${escapeHTML(channel.name)}
      <span class="notice">(${escapeHTML(channel.id)})</span>
    </label>
  `).join("") || '<p class="empty">Agrega canales primero.</p>';
}

function renderCommands() {
  const visible = commands.filter(
    command => command.type === currentTab
  );

  $("commandList").innerHTML = visible.map(command => `
    <article class="command">
      <div class="command-head">
        <div>
          <div class="command-name">${escapeHTML(command.name)}</div>
          <div class="channels">${
            command.channels.length
              ? command.channels.map(id =>
                  escapeHTML(channelName(id))
                ).join(", ")
              : "Sin canales asignados"
          }</div>
        </div>

        <div class="state mod-state ${command.mod ? "" : "off"}">
          ${command.mod ? "✓ Mod" : "— Mod"}
        </div>

        <div class="state active-state ${command.active ? "" : "off"}">
          ${command.active ? "✓ Activo" : "✕ Inactivo"}
        </div>

        <button type="button" class="edit"
          data-edit="${command.id}" aria-label="Editar comando">✎</button>
      </div>

      <div class="response">${
        escapeHTML(command.response) ||
        '<span class="notice">Sin respuesta configurada</span>'
      }</div>
    </article>
  `).join("") ||
    '<div class="empty">Todavía no hay comandos en esta sección.</div>';
}

function openEditor(id = null) {
  editingId = id;
  const command = commands.find(item => item.id === id);

  $("editorTitle").textContent =
    command ? "Editar comando" : "Nuevo comando";

  $("commandName").value = command?.name || "!";
  $("commandMod").checked = command?.mod || false;
  $("commandActive").checked = command ? command.active : true;
  $("commandResponse").value = command?.response || "";

  renderChannels();

  document.querySelectorAll('[name="editorChannel"]').forEach(input => {
    input.checked = Boolean(command?.channels.includes(input.value));
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

$("channelForm").addEventListener("submit", event => {
  event.preventDefault();

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

  channels.push({ id, name: id });
  $("newChannel").value = "";
  renderChannels();
});

$("channelList").addEventListener("click", event => {
  const button = event.target.closest("[data-remove-channel]");
  if (!button) return;

  const id = button.dataset.removeChannel;

  if (!confirm(`¿Retirar ${id} de los canales disponibles?`)) return;

  const index = channels.findIndex(channel => channel.id === id);
  if (index !== -1) channels.splice(index, 1);

  commands.forEach(command => {
    command.channels = command.channels.filter(
      channelId => channelId !== id
    );
  });

  renderChannels();
  renderCommands();
});

$("commandList").addEventListener("click", event => {
  const button = event.target.closest("[data-edit]");
  if (button) openEditor(Number(button.dataset.edit));
});

$("editorForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = $("commandName").value.trim().toLowerCase();

  if (!/^![a-z0-9_]+$/.test(name)) {
    alert("El comando debe comenzar con ! y usar letras, números o _.");
    return;
  }

  const duplicate = commands.some(command =>
    command.type === currentTab &&
    command.name.toLowerCase() === name &&
    command.id !== editingId
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
    name,
    type: currentTab,
    channels: selectedChannels,
    mod: $("commandMod").checked,
    active: $("commandActive").checked,
    response: $("commandResponse").value.trim()
  };

  if (editingId !== null) {
    const index = commands.findIndex(
      command => command.id === editingId
    );

    commands[index] = { ...commands[index], ...data };
  } else {
    commands.push({ id: Date.now(), ...data });
  }

  closeEditor();
  renderCommands();
});

renderChannels();
renderCommands();
