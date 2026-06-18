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

// Utility: mostra errore visibile all'utente per 4 secondi
function mostraErrore(msg) {
  const toast = document.getElementById("errore-toast");
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.hidden = true; }, 4000);
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
  checkbox.disabled = v.comprato;
  checkbox.addEventListener("change", () => spostaInDispensa(v.id, checkbox));

  const info = document.createElement("div");
  info.className = "info";
  if (!v.comprato) info.addEventListener("click", () => apriModificaLista(li, v));

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

  const btnElimina = document.createElement("button");
  btnElimina.className = "btn-elimina";
  btnElimina.textContent = "✕";
  btnElimina.title = "Elimina";
  btnElimina.addEventListener("click", () => eliminaVoceLista(v.id));

  li.appendChild(checkbox);
  li.appendChild(info);
  li.appendChild(btnElimina);

  return li;
}

async function eliminaVoceLista(id) {
  const risposta = await fetch(`/api/lista/${id}`, { method: "DELETE" });
  if (!risposta.ok) {
    mostraErrore("Errore durante l'eliminazione.");
    return;
  }
  await caricaLista();
}

async function spostaInDispensa(id, checkbox) {
  checkbox.disabled = true;
  const risposta = await fetch(`/api/lista/${id}/sposta-in-dispensa`, { method: "POST" });
  if (!risposta.ok) {
    checkbox.disabled = false;
    checkbox.checked = false;
    mostraErrore("Errore durante il trasferimento in dispensa.");
    return;
  }
  await Promise.all([caricaLista(), caricaDispensa()]);
}

function apriModificaLista(li, v) {
  li.innerHTML = "";

  const form = document.createElement("form");
  form.className = "form-inline-dispensa";

  const inputNome = document.createElement("input");
  inputNome.type = "text";
  inputNome.className = "input-edit-nome";
  inputNome.value = v.nome;
  inputNome.required = true;

  const inputQty = document.createElement("input");
  inputQty.type = "number";
  inputQty.className = "input-edit-qty";
  inputQty.value = v.quantita_desiderata;
  inputQty.step = "any";
  inputQty.min = "0.01";
  inputQty.required = true;

  const inputNote = document.createElement("input");
  inputNote.type = "text";
  inputNote.className = "input-edit-note";
  inputNote.value = v.note || "";
  inputNote.placeholder = "Note";

  const btnSalva = document.createElement("button");
  btnSalva.type = "submit";
  btnSalva.className = "btn-salva";
  btnSalva.textContent = "Salva";

  const btnAnnulla = document.createElement("button");
  btnAnnulla.type = "button";
  btnAnnulla.className = "btn-annulla";
  btnAnnulla.textContent = "Annulla";
  btnAnnulla.addEventListener("click", () => li.replaceWith(creaElementoLista(v)));

  form.append(inputNome, inputQty, inputNote, btnSalva, btnAnnulla);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = inputNome.value.trim();
    const qty = parseFloat(inputQty.value);
    if (!nome || isNaN(qty)) return;
    const risposta = await fetch(`/api/lista/${v.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, quantita_desiderata: qty, note: inputNote.value.trim() || null }),
    });
    if (!risposta.ok) {
      mostraErrore("Errore durante il salvataggio.");
      return;
    }
    await caricaLista();
  });

  li.appendChild(form);
  inputNome.focus();
}

document.getElementById("btn-fine-spesa").addEventListener("click", async () => {
  if (!confirm("Confermi di aver finito la spesa? Gli articoli comprati verranno rimossi dalla lista.")) return;
  const risposta = await fetch("/api/lista/comprati", { method: "DELETE" });
  if (!risposta.ok) {
    mostraErrore("Errore durante la fine spesa.");
    return;
  }
  await caricaLista();
});

document.getElementById("form-lista").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("lista-nome").value.trim();
  const qty = parseFloat(document.getElementById("lista-qty").value);
  const note = document.getElementById("lista-note").value.trim() || null;
  if (!nome || isNaN(qty)) return;

  const risposta = await fetch("/api/lista", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome, quantita_desiderata: qty, note }),
  });
  if (!risposta.ok) {
    mostraErrore("Errore durante l'aggiunta dell'articolo.");
    return;
  }

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
  info.addEventListener("click", () => apriModificaDispensa(li, v));

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

  const btnLista = document.createElement("button");
  btnLista.className = "btn-lista";
  btnLista.textContent = "+";
  btnLista.title = "Rimetti in lista";
  btnLista.addEventListener("click", () => rimmettiInLista(v.id, btnLista));

  const btnElimina = document.createElement("button");
  btnElimina.className = "btn-elimina";
  btnElimina.textContent = "✕";
  btnElimina.title = "Elimina";
  btnElimina.addEventListener("click", () => eliminaVoceDispensa(v.id));

  li.appendChild(info);
  li.appendChild(btnLista);
  li.appendChild(btnElimina);

  return li;
}

async function rimmettiInLista(id, btn) {
  btn.disabled = true;
  const risposta = await fetch(`/api/dispensa/${id}/aggiungi-in-lista`, { method: "POST" });
  if (!risposta.ok) {
    btn.disabled = false;
    mostraErrore("Errore durante l'aggiunta in lista.");
    return;
  }
  btn.textContent = "✓";
  setTimeout(() => { btn.textContent = "+"; btn.disabled = false; }, 1500);
  if (risposta.status === 201) await caricaLista();
}

function apriModificaDispensa(li, v) {
  li.innerHTML = "";

  const form = document.createElement("form");
  form.className = "form-inline-dispensa";

  const inputNome = document.createElement("input");
  inputNome.type = "text";
  inputNome.className = "input-edit-nome";
  inputNome.value = v.nome;
  inputNome.required = true;

  const inputQty = document.createElement("input");
  inputQty.type = "number";
  inputQty.className = "input-edit-qty";
  inputQty.value = v.quantita_disponibile;
  inputQty.step = "any";
  inputQty.min = "0";
  inputQty.required = true;

  const inputNote = document.createElement("input");
  inputNote.type = "text";
  inputNote.className = "input-edit-note";
  inputNote.value = v.note || "";
  inputNote.placeholder = "Note";

  const btnSalva = document.createElement("button");
  btnSalva.type = "submit";
  btnSalva.className = "btn-salva";
  btnSalva.textContent = "Salva";

  const btnAnnulla = document.createElement("button");
  btnAnnulla.type = "button";
  btnAnnulla.className = "btn-annulla";
  btnAnnulla.textContent = "Annulla";
  btnAnnulla.addEventListener("click", () => li.replaceWith(creaElementoDispensa(v)));

  form.append(inputNome, inputQty, inputNote, btnSalva, btnAnnulla);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = inputNome.value.trim();
    const qty = parseFloat(inputQty.value);
    if (!nome || isNaN(qty)) return;
    const risposta = await fetch(`/api/dispensa/${v.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, quantita_disponibile: qty, note: inputNote.value.trim() || null }),
    });
    if (!risposta.ok) {
      mostraErrore("Errore durante il salvataggio.");
      return;
    }
    await caricaDispensa();
  });

  li.appendChild(form);
  inputNome.focus();
}

async function eliminaVoceDispensa(id) {
  const risposta = await fetch(`/api/dispensa/${id}`, { method: "DELETE" });
  if (!risposta.ok) {
    mostraErrore("Errore durante l'eliminazione.");
    return;
  }
  await caricaDispensa();
}

document.getElementById("btn-svuota-dispensa").addEventListener("click", async () => {
  if (!confirm("Sei sicuro di voler cancellare TUTTA la dispensa?\n\nQuesta azione è irreversibile e non può essere annullata.")) return;
  const risposta = await fetch("/api/dispensa", { method: "DELETE" });
  if (!risposta.ok) {
    mostraErrore("Errore durante lo svuotamento della dispensa.");
    return;
  }
  await caricaDispensa();
});

document.getElementById("form-dispensa").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("dispensa-nome").value.trim();
  const qty = parseFloat(document.getElementById("dispensa-qty").value);
  const note = document.getElementById("dispensa-note").value.trim() || null;
  if (!nome || isNaN(qty)) return;

  const risposta = await fetch("/api/dispensa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome, quantita_disponibile: qty, note }),
  });
  if (!risposta.ok) {
    mostraErrore("Errore durante l'aggiunta dell'articolo.");
    return;
  }

  document.getElementById("dispensa-nome").value = "";
  document.getElementById("dispensa-qty").value = "1";
  document.getElementById("dispensa-note").value = "";
  document.getElementById("dispensa-nome").focus();
  await caricaDispensa();
});

// Init
caricaLista();
caricaDispensa();
