
const $ = id => document.getElementById(id);

let currentTab = "simple";
let editingId = null;

let channels = [
  { id: "jaciitv", name: "JaciiTV" },
  { id: "ebastos14", name: "EBastos14" },
  { id: "boteb14", name: "BotEB14" }
];

let commands = [
  {
    id: 1, type: "simple", name: "!ping",
    channels: ["jaciitv", "ebastos14", "boteb14"],
    mod: false, active: true, response: "pong"
  },
  {
    id: 2, type: "simple", name: "!hola",
    channels: ["jaciitv"],
    mod: false, active: true, response: "¡Hola, shat!"
  },
  {
    id: 3, type: "categoria", name: "!drops",
    channels: ["jaciitv", "boteb14"],
    mod: false, active: true,
    response: "Los enlaces de drops dependen del juego."
  },
  {
    id: 4, type: "modular", name: "!pingmod",
    channels: ["jaciitv"],
    mod: true, active: true, response: "¡Pong modular!"
  }
];

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[char]);
}

function channelName(id) {
  return channels.find(c => c.id === id)?.name || id;
}

function renderChannels() {
  $("channelList").innerHTML = channels.map(c => `
    <div class="channel-choice">
      <span>${escapeHTML(c.name)} <small>(${escapeHTML(c.id)})</small></span>
      <button type="button" data-remove="${escapeHTML(c.id)}">×</button>
    </div>
  `).join("") || '<p class="empty">No hay canales registrados.</p>';

  $("editorChannels").innerHTML = channels.map(c => `
    <label class="channel-choice">
      <input type="checkbox" name="editorChannel" value="${escapeHTML(c.id)}">
      ${escapeHTML(c.name)} (${escapeHTML(c.id)})
    </label>
  `).join("") || '<p class="empty">Agrega canales primero.</p>';
}

function renderCommands() {
  const visible = commands.filter(c => c.type === currentTab);

  $("commandList").innerHTML = visible.map(c => `
    <article class="command">
      <div class="command-head">
        <div>
          <div class="command-name">${escapeHTML(c.name)}</div>
          <div class="channels">${
            c.channels.length
              ? c.channels.map(channelName).map(escapeHTML).join(", ")
              : "Sin canales asignados"
          }</div>
        </div>
        <div class="state ${c.mod ? "" : "off"}">
          ${c.mod ? "✓ Mod" : "— Mod"}
        </div>
        <div class="state ${c.active ? "" : "off"}">
          ${c.active ? "✓ Activo" : "✕ Inactivo"}
        </div>
        <button type="button" class="edit" data-edit="${c.id}">✎</button>
      </div>
      <div class="response">${escapeHTML(c.response) ||
        '<span class="notice">Sin respuesta configurada</span>'}</div>
    </article>
  `).join("") || '<p class="empty">No hay comandos en esta categoría.</p>';
}

function openEditor(id = null) {
  editingId = id;
  const c = commands.find(item => item.id === id);

  $("editorTitle").textContent = c ? "Editar comando" : "Nuevo comando";
  $("commandName").value = c?.name || "!";
  $("commandMod").checked = c?.mod ?? false;
  $("commandActive").checked = c?.active ?? true;
  $("commandResponse").value = c?.response || "";

  renderChannels();

  document.querySelectorAll('[name="editorChannel"]').forEach(input => {
    input.checked = c ? c.channels.includes(input.value) : false;
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
    document.querySelectorAll("[data-tab]").forEach(tab =>
      tab.classList.toggle("selected", tab === button)
    );
    renderCommands();
  });
});

$("manageChannels").addEventListener("click", () => {
  $("channelManager").hidden = !$("channelManager").hidden;
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

  const id = $("newChannel").value.trim().replace(/^@/, "").toLowerCase();

  if (!/^[a-z0-9_]{1,25}$/.test(id)) {
    alert("Escribe un nombre de canal válido.");
    return;
  }

  if (channels.some(c => c.id === id)) {
    alert("Ese canal ya está registrado.");
    return;
  }

  channels.push({ id, name: id });
  $("newChannel").value = "";
  renderChannels();
});

$("channelList").addEventListener("click", event => {
  const button = event.target.closest("[data-remove]");
  if (!button) return;

  const id = button.dataset.remove;
  if (!confirm(`¿Retirar ${id} de los canales disponibles?`)) return;

  channels = channels.filter(c => c.id !== id);
  commands.forEach(c => {
    c.channels = c.channels.filter(channel => channel !== id);
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

  if (commands.some(c =>
    c.type === currentTab &&
    c.name === name &&
    c.id !== editingId
  )) {
    alert("Ese comando ya existe en esta categoría.");
    return;
  }

  const data = {
    type: currentTab,
    name,
    mod: $("commandMod").checked,
    active: $("commandActive").checked,
    response: $("commandResponse").value,
    channels: [...document.querySelectorAll(
      '[name="editorChannel"]:checked'
    )].map(input => input.value)
  };

  if (editingId !== null) {
    const index = commands.findIndex(c => c.id === editingId);
    commands[index] = { ...commands[index], ...data };
  } else {
    commands.push({ id: Date.now(), ...data });
  }

  closeEditor();
  renderCommands();
});

renderChannels();
renderCommands();
