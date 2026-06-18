// Tab switching
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("attiva"));
    document.querySelectorAll(".sezione-tab").forEach((s) => s.classList.remove("attiva"));
    btn.classList.add("attiva");
    document.getElementById("sezione-" + btn.dataset.tab).classList.add("attiva");
  });
});

// Utility: formatta numero (evita ".0" superfluo)
function fmtQty(n) {
  return Number.isInteger(n) ? String(n) : String(n);
}

// ---- Lista della spesa ----

async function caricaLista() {
  const risposta = await fetch("/api/lista");
  const voci = await risposta.json();
  renderLista(voci);
}

function renderLista(voci) {
  const lista = document.getElementById("lista-articoli");
  const vuoto = document.getElementById("lista-vuota");
  lista.innerHTML = "";
  vuoto.hidden = voci.length > 0;
  for (const v of voci) lista.appendChild(creaElementoLista(v));
}

function creaElementoLista(v) {
  const li = document.createElement("li");
  li.className = "articolo" + (v.comprato ? " comprato" : "");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = v.comprato;
  checkbox.addEventListener("change", () => toggleComprato(v.id));

  const info = document.createElement("div");
  info.className = "info";
  info.addEventListener("click", () => toggleComprato(v.id));

  const nome = document.createElement("span");
  nome.className = "nome";
  nome.textContent = v.nome;

  const qty = document.createElement("span");
  qty.className = "quantita";
  qty.textContent = `Qtà: ${fmtQty(v.quantita_desiderata)}`;

  info.appendChild(nome);
  info.appendChild(qty);

  if (v.note) {
    const nota = document.createElement("span");
    nota.className = "nota";
    nota.textContent = v.note;
    info.appendChild(nota);
  }

  const btnDispensa = document.createElement("button");
  btnDispensa.className = "btn-dispensa";
  btnDispensa.textContent = "→";
  btnDispensa.title = "Sposta in dispensa";
  btnDispensa.addEventListener("click", () => spostaInDispensa(v.id));

  const btnElimina = document.createElement("button");
  btnElimina.className = "btn-elimina";
  btnElimina.textContent = "✕";
  btnElimina.title = "Elimina";
  btnElimina.addEventListener("click", () => eliminaVoceLista(v.id));

  li.appendChild(checkbox);
  li.appendChild(info);
  li.appendChild(btnDispensa);
  li.appendChild(btnElimina);

  return li;
}

async function toggleComprato(id) {
  await fetch(`/api/lista/${id}/comprato`, { method: "PATCH" });
  await caricaLista();
}

async function eliminaVoceLista(id) {
  await fetch(`/api/lista/${id}`, { method: "DELETE" });
  await caricaLista();
}

async function spostaInDispensa(id) {
  await fetch(`/api/lista/${id}/sposta-in-dispensa`, { method: "POST" });
  await Promise.all([caricaLista(), caricaDispensa()]);
}

document.getElementById("form-lista").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("lista-nome").value.trim();
  const qty = parseFloat(document.getElementById("lista-qty").value);
  const note = document.getElementById("lista-note").value.trim() || null;
  if (!nome || isNaN(qty)) return;

  await fetch("/api/lista", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome, quantita_desiderata: qty, note }),
  });

  document.getElementById("lista-nome").value = "";
  document.getElementById("lista-qty").value = "1";
  document.getElementById("lista-note").value = "";
  document.getElementById("lista-nome").focus();
  await caricaLista();
});

// ---- Dispensa ----

async function caricaDispensa() {
  const risposta = await fetch("/api/dispensa");
  const voci = await risposta.json();
  renderDispensa(voci);
}

function renderDispensa(voci) {
  const lista = document.getElementById("dispensa-articoli");
  const vuoto = document.getElementById("dispensa-vuota");
  lista.innerHTML = "";
  vuoto.hidden = voci.length > 0;
  for (const v of voci) lista.appendChild(creaElementoDispensa(v));
}

function creaElementoDispensa(v) {
  const li = document.createElement("li");
  li.className = "articolo";

  const info = document.createElement("div");
  info.className = "info";

  const nome = document.createElement("span");
  nome.className = "nome";
  nome.textContent = v.nome;

  const qty = document.createElement("span");
  qty.className = "quantita";
  qty.textContent = `Disponibile: ${fmtQty(v.quantita_disponibile)}`;

  info.appendChild(nome);
  info.appendChild(qty);

  if (v.note) {
    const nota = document.createElement("span");
    nota.className = "nota";
    nota.textContent = v.note;
    info.appendChild(nota);
  }

  const btnElimina = document.createElement("button");
  btnElimina.className = "btn-elimina";
  btnElimina.textContent = "✕";
  btnElimina.title = "Elimina";
  btnElimina.addEventListener("click", () => eliminaVoceDispensa(v.id));

  li.appendChild(info);
  li.appendChild(btnElimina);

  return li;
}

async function eliminaVoceDispensa(id) {
  await fetch(`/api/dispensa/${id}`, { method: "DELETE" });
  await caricaDispensa();
}

document.getElementById("form-dispensa").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("dispensa-nome").value.trim();
  const qty = parseFloat(document.getElementById("dispensa-qty").value);
  const note = document.getElementById("dispensa-note").value.trim() || null;
  if (!nome || isNaN(qty)) return;

  await fetch("/api/dispensa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome, quantita_disponibile: qty, note }),
  });

  document.getElementById("dispensa-nome").value = "";
  document.getElementById("dispensa-qty").value = "1";
  document.getElementById("dispensa-note").value = "";
  document.getElementById("dispensa-nome").focus();
  await caricaDispensa();
});

// Init
caricaLista();
caricaDispensa();
