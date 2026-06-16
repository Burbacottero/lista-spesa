const API_URL = "/api/articoli";

const form = document.getElementById("form-articolo");
const inputNome = document.getElementById("input-nome");
const inputQuantita = document.getElementById("input-quantita");
const lista = document.getElementById("lista-articoli");
const messaggioVuoto = document.getElementById("messaggio-vuoto");

async function caricaArticoli() {
  const risposta = await fetch(API_URL);
  const articoli = await risposta.json();
  renderArticoli(articoli);
}

function renderArticoli(articoli) {
  lista.innerHTML = "";
  messaggioVuoto.hidden = articoli.length > 0;

  for (const articolo of articoli) {
    lista.appendChild(creaElementoArticolo(articolo));
  }
}

function creaElementoArticolo(articolo) {
  const li = document.createElement("li");
  li.className = "articolo" + (articolo.comprato ? " comprato" : "");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = articolo.comprato;
  checkbox.addEventListener("change", () => toggleComprato(articolo.id));

  const info = document.createElement("div");
  info.className = "info";
  info.addEventListener("click", () => toggleComprato(articolo.id));

  const nome = document.createElement("span");
  nome.className = "nome";
  nome.textContent = articolo.nome;

  const quantita = document.createElement("span");
  quantita.className = "quantita";
  quantita.textContent = `Quantità: ${articolo.quantita}`;

  info.appendChild(nome);
  info.appendChild(quantita);

  const btnElimina = document.createElement("button");
  btnElimina.className = "btn-elimina";
  btnElimina.textContent = "✕";
  btnElimina.title = "Elimina articolo";
  btnElimina.addEventListener("click", () => eliminaArticolo(articolo.id));

  li.appendChild(checkbox);
  li.appendChild(info);
  li.appendChild(btnElimina);

  return li;
}

async function aggiungiArticolo(nome, quantita) {
  await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome, quantita }),
  });
  await caricaArticoli();
}

async function toggleComprato(id) {
  await fetch(`${API_URL}/${id}/comprato`, { method: "PATCH" });
  await caricaArticoli();
}

async function eliminaArticolo(id) {
  await fetch(`${API_URL}/${id}`, { method: "DELETE" });
  await caricaArticoli();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const nome = inputNome.value.trim();
  const quantita = inputQuantita.value.trim();
  if (!nome || !quantita) return;

  await aggiungiArticolo(nome, quantita);
  inputNome.value = "";
  inputQuantita.value = "";
  inputNome.focus();
});

caricaArticoli();
