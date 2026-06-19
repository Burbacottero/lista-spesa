// --- Costanti catalogo ---

const CATEGORIE = {
  frutta_verdura: { emoji: '🥦', label: 'Frutta e verdura' },
  latticini:      { emoji: '🧀', label: 'Latticini' },
  carne_pesce:    { emoji: '🥩', label: 'Carne e pesce' },
  dispensa_secca: { emoji: '🫙', label: 'Dispensa secca' },
  bevande:        { emoji: '🧃', label: 'Bevande' },
  surgelati:      { emoji: '🧊', label: 'Surgelati' },
  casa_igiene:    { emoji: '🧼', label: 'Casa e igiene' },
  altro:          { emoji: '📦', label: 'Altro' },
};
const CATEGORIE_ORDER = Object.keys(CATEGORIE);
const UNITA_MISURA = ['pz', 'g', 'kg', 'ml', 'l', 'conf'];

// --- Popolamento select statiche dei form di aggiunta ---

function populateSelects() {
  for (const id of ['lista-categoria', 'dispensa-categoria']) {
    const sel = document.getElementById(id);
    for (const [key, { emoji, label }] of Object.entries(CATEGORIE)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = `${emoji} ${label}`;
      sel.appendChild(opt);
    }
  }
  for (const id of ['lista-unita', 'dispensa-unita']) {
    const sel = document.getElementById(id);
    for (const u of UNITA_MISURA) {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u;
      sel.appendChild(opt);
    }
  }
}

// --- Utility ---

function fmtQty(n, unita) {
  const s = Number.isInteger(n) ? String(n) : String(n);
  return unita && unita !== 'pz' ? `${s} ${unita}` : s;
}

function mostraErrore(msg) {
  const toast = document.getElementById('errore-toast');
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.hidden = true; }, 4000);
}

function calcolaBadgeScadenza(data_scadenza) {
  if (!data_scadenza) return null;
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  const scad = new Date(data_scadenza);
  scad.setHours(0, 0, 0, 0);
  const giorni = Math.round((scad - oggi) / 86400000);
  if (giorni < 0)  return { testo: 'Scaduto',                              classe: 'badge-scaduto' };
  if (giorni === 0) return { testo: 'Scade oggi',                          classe: 'badge-urgente' };
  if (giorni <= 3)  return { testo: `Scade in ${giorni} giorn${giorni === 1 ? 'o' : 'i'}`, classe: 'badge-urgente' };
  if (giorni <= 7)  return { testo: `Scade in ${giorni} giorni`,           classe: 'badge-presto' };
  return null;
}

// --- Auth: redirect a /login su risposta 401 ---

async function apiFetch(url, opts = {}) {
  const r = await fetch(url, opts);
  if (r.status === 401) {
    window.location.href = '/login';
    return null;
  }
  return r;
}

// --- Utente corrente ---

async function caricaUtente() {
  const r = await apiFetch('/api/me');
  if (!r || !r.ok) return;
  const u = await r.json();
  document.getElementById('saluto-utente').textContent = `Ciao, ${u.nome_visualizzato}`;
}

// --- Autocomplete ---

let _acTimer = null;
const _acCache = new Map(); // nome.toLowerCase() → prodotto

function aggiornaAutocomplete(inputEl, catSel, unitaSel) {
  const val = inputEl.value.trim();

  // Pre-fill immediato da cache
  const matchImm = _acCache.get(val.toLowerCase());
  if (matchImm) {
    if (catSel)  catSel.value  = matchImm.categoria;
    if (unitaSel) unitaSel.value = matchImm.unita_misura;
  }

  clearTimeout(_acTimer);
  if (!val) return;

  _acTimer = setTimeout(async () => {
    let r;
    try { r = await apiFetch(`/api/prodotti?search=${encodeURIComponent(val)}`); }
    catch { return; }
    if (!r || !r.ok) return;

    const prodotti = await r.json();
    const datalist = document.getElementById('prodotti-datalist');
    datalist.innerHTML = '';
    for (const p of prodotti) {
      _acCache.set(p.nome.toLowerCase(), p);
      const opt = document.createElement('option');
      opt.value = p.nome;
      datalist.appendChild(opt);
    }

    // Pre-fill dopo fetch
    const match = _acCache.get(inputEl.value.trim().toLowerCase());
    if (match) {
      if (catSel)  catSel.value  = match.categoria;
      if (unitaSel) unitaSel.value = match.unita_misura;
    }
  }, 200);
}

// --- Tab switching ---

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('attiva'));
    document.querySelectorAll('.sezione-tab').forEach(s => s.classList.remove('attiva'));
    btn.classList.add('attiva');
    document.getElementById('sezione-' + btn.dataset.tab).classList.add('attiva');
  });
});

// --- Helper: costruttori elementi form inline ---

function creaSelectCategoria(val = 'altro') {
  const sel = document.createElement('select');
  for (const [key, { emoji, label }] of Object.entries(CATEGORIE)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `${emoji} ${label}`;
    if (key === val) opt.selected = true;
    sel.appendChild(opt);
  }
  return sel;
}

function creaSelectUnita(val = 'pz') {
  const sel = document.createElement('select');
  for (const u of UNITA_MISURA) {
    const opt = document.createElement('option');
    opt.value = u;
    opt.textContent = u;
    if (u === val) opt.selected = true;
    sel.appendChild(opt);
  }
  return sel;
}

// --- Raggruppamento articoli per categoria ---

function groupByCategoria(voci) {
  const map = new Map(CATEGORIE_ORDER.map(k => [k, []]));
  for (const v of voci) {
    const cat = v.categoria || 'altro';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat).push(v);
  }
  return map;
}

// --- Etichetta autore discreta ---

function creaEtichettaAutore(v) {
  const nome = v.comprato_da_nome ?? v.aggiunto_da_nome;
  if (!nome) return null;
  const span = document.createElement('span');
  span.className = 'autore';
  span.textContent = v.comprato_da_nome
    ? `Comprato da ${v.comprato_da_nome}`
    : `Aggiunto da ${v.aggiunto_da_nome}`;
  return span;
}

// ====== LISTA DELLA SPESA ======

async function caricaLista() {
  const r = await apiFetch('/api/lista');
  if (!r) return;
  renderLista(await r.json());
}

function renderLista(voci) {
  const ul   = document.getElementById('lista-articoli');
  const vuoto = document.getElementById('lista-vuota');
  ul.innerHTML = '';
  vuoto.hidden = voci.length > 0;
  if (!voci.length) return;

  const gruppi = groupByCategoria(voci);
  const totGruppi = [...gruppi.values()].filter(g => g.length > 0).length;

  for (const [cat, items] of gruppi) {
    if (!items.length) continue;

    if (totGruppi > 1) {
      const header = document.createElement('li');
      header.className = 'gruppo-header';
      header.innerHTML = `<span>${CATEGORIE[cat]?.emoji ?? '📦'}</span><span>${CATEGORIE[cat]?.label ?? cat}</span>`;
      ul.appendChild(header);
    }

    for (const v of items) ul.appendChild(creaElementoLista(v));
  }
}

function creaElementoLista(v) {
  const li = document.createElement('li');
  li.className = 'articolo' + (v.comprato ? ' comprato' : '');
  li.dataset.categoria = v.categoria || 'altro';

  const bar = document.createElement('div');
  bar.className = 'cat-bar';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = v.comprato;
  checkbox.disabled = v.comprato;
  checkbox.addEventListener('change', () => spostaInDispensa(v.id, checkbox));

  const info = document.createElement('div');
  info.className = 'info';
  if (!v.comprato) info.addEventListener('click', () => apriModificaLista(li, v));

  const nome = document.createElement('span');
  nome.className = 'nome';
  nome.textContent = v.nome;

  const meta = document.createElement('div');
  meta.className = 'meta';

  const qty = document.createElement('span');
  qty.className = 'quantita';
  qty.textContent = fmtQty(v.quantita_desiderata, v.unita_misura);
  meta.appendChild(qty);

  if (v.note) {
    const nota = document.createElement('span');
    nota.className = 'nota';
    nota.textContent = v.note;
    meta.appendChild(nota);
  }

  info.appendChild(nome);
  info.appendChild(meta);

  const autore = creaEtichettaAutore(v);
  if (autore) info.appendChild(autore);

  const btnElimina = document.createElement('button');
  btnElimina.className = 'btn-elimina';
  btnElimina.textContent = '✕';
  btnElimina.title = 'Elimina';
  btnElimina.addEventListener('click', () => eliminaVoceLista(v.id));

  li.appendChild(bar);
  li.appendChild(checkbox);
  li.appendChild(info);
  li.appendChild(btnElimina);
  return li;
}

async function eliminaVoceLista(id) {
  const r = await apiFetch(`/api/lista/${id}`, { method: 'DELETE' });
  if (!r) return;
  if (!r.ok) { mostraErrore("Errore durante l'eliminazione."); return; }
  await caricaLista();
}

async function spostaInDispensa(id, checkbox) {
  checkbox.disabled = true;
  const r = await apiFetch(`/api/lista/${id}/sposta-in-dispensa`, { method: 'POST' });
  if (!r) return;
  if (!r.ok) {
    checkbox.disabled = false;
    checkbox.checked = false;
    mostraErrore('Errore durante il trasferimento in dispensa.');
    return;
  }
  await Promise.all([caricaLista(), caricaDispensa()]);
}

function apriModificaLista(li, v) {
  li.innerHTML = '';

  const form = document.createElement('form');
  form.className = 'form-inline';

  const inputNome = document.createElement('input');
  inputNome.type = 'text';
  inputNome.className = 'input-edit-nome';
  inputNome.value = v.nome;
  inputNome.required = true;
  inputNome.list = 'prodotti-datalist';

  const inputQty = document.createElement('input');
  inputQty.type = 'number';
  inputQty.className = 'input-edit-qty';
  inputQty.value = v.quantita_desiderata;
  inputQty.step = 'any';
  inputQty.min = '0.01';
  inputQty.required = true;

  const selCat   = creaSelectCategoria(v.categoria);
  const selUnita = creaSelectUnita(v.unita_misura);

  const inputNote = document.createElement('input');
  inputNote.type = 'text';
  inputNote.className = 'input-edit-note';
  inputNote.value = v.note || '';
  inputNote.placeholder = 'Note';

  const btnSalva = document.createElement('button');
  btnSalva.type = 'submit';
  btnSalva.className = 'btn-salva';
  btnSalva.textContent = 'Salva';

  const btnAnnulla = document.createElement('button');
  btnAnnulla.type = 'button';
  btnAnnulla.className = 'btn-annulla';
  btnAnnulla.textContent = 'Ann.';
  btnAnnulla.addEventListener('click', () => li.replaceWith(creaElementoLista(v)));

  inputNome.addEventListener('input', () => aggiornaAutocomplete(inputNome, selCat, selUnita));

  form.append(inputNome, inputQty, selCat, selUnita, inputNote, btnSalva, btnAnnulla);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const nome = inputNome.value.trim();
    const qty  = parseFloat(inputQty.value);
    if (!nome || isNaN(qty)) return;
    const r = await apiFetch(`/api/lista/${v.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome,
        quantita_desiderata: qty,
        categoria:    selCat.value,
        unita_misura: selUnita.value,
        note: inputNote.value.trim() || null,
      }),
    });
    if (!r) return;
    if (!r.ok) { mostraErrore('Errore durante il salvataggio.'); return; }
    await caricaLista();
  });

  li.appendChild(form);
  inputNome.focus();
}

document.getElementById('btn-fine-spesa').addEventListener('click', async () => {
  if (!confirm('Confermi di aver finito la spesa? Gli articoli comprati verranno rimossi dalla lista.')) return;
  const r = await apiFetch('/api/lista/comprati', { method: 'DELETE' });
  if (!r) return;
  if (!r.ok) { mostraErrore('Errore durante la fine spesa.'); return; }
  await caricaLista();
});

document.getElementById('btn-cancella-lista').addEventListener('click', async () => {
  if (!confirm('Sei sicuro di voler cancellare TUTTA la lista?\n\nVerranno eliminati tutti gli articoli, compresi quelli non ancora comprati. Questa azione è irreversibile.')) return;
  const r = await apiFetch('/api/lista', { method: 'DELETE' });
  if (!r) return;
  if (!r.ok) { mostraErrore('Errore durante la cancellazione della lista.'); return; }
  await caricaLista();
});

document.getElementById('form-lista').addEventListener('submit', async e => {
  e.preventDefault();
  const nome = document.getElementById('lista-nome').value.trim();
  const qty  = parseFloat(document.getElementById('lista-qty').value);
  const note = document.getElementById('lista-note').value.trim() || null;
  if (!nome || isNaN(qty)) return;

  const r = await apiFetch('/api/lista', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome,
      quantita_desiderata: qty,
      categoria:    document.getElementById('lista-categoria').value,
      unita_misura: document.getElementById('lista-unita').value,
      note,
    }),
  });
  if (!r) return;
  if (!r.ok) { mostraErrore("Errore durante l'aggiunta dell'articolo."); return; }

  document.getElementById('lista-nome').value = '';
  document.getElementById('lista-qty').value  = '1';
  document.getElementById('lista-note').value = '';
  document.getElementById('lista-categoria').value = 'altro';
  document.getElementById('lista-unita').value     = 'pz';
  document.getElementById('lista-nome').focus();
  await caricaLista();
});

// Autocomplete sul form di aggiunta lista
document.getElementById('lista-nome').addEventListener('input', () => {
  aggiornaAutocomplete(
    document.getElementById('lista-nome'),
    document.getElementById('lista-categoria'),
    document.getElementById('lista-unita'),
  );
});

// ====== DISPENSA ======

async function caricaDispensa() {
  const r = await apiFetch('/api/dispensa');
  if (!r) return;
  renderDispensa(await r.json());
}

function renderDispensa(voci) {
  const ul    = document.getElementById('dispensa-articoli');
  const vuoto = document.getElementById('dispensa-vuota');
  ul.innerHTML = '';
  vuoto.hidden = voci.length > 0;
  if (!voci.length) return;

  const gruppi = groupByCategoria(voci);
  const totGruppi = [...gruppi.values()].filter(g => g.length > 0).length;

  for (const [cat, items] of gruppi) {
    if (!items.length) continue;

    if (totGruppi > 1) {
      const header = document.createElement('li');
      header.className = 'gruppo-header';
      header.innerHTML = `<span>${CATEGORIE[cat]?.emoji ?? '📦'}</span><span>${CATEGORIE[cat]?.label ?? cat}</span>`;
      ul.appendChild(header);
    }

    for (const v of items) ul.appendChild(creaElementoDispensa(v));
  }
}

function creaElementoDispensa(v) {
  const li = document.createElement('li');
  li.className = 'articolo';
  li.dataset.categoria = v.categoria || 'altro';

  const bar = document.createElement('div');
  bar.className = 'cat-bar';

  const info = document.createElement('div');
  info.className = 'info';
  info.addEventListener('click', () => apriModificaDispensa(li, v));

  const nome = document.createElement('span');
  nome.className = 'nome';
  nome.textContent = v.nome;

  const meta = document.createElement('div');
  meta.className = 'meta';

  const qty = document.createElement('span');
  qty.className = 'quantita';
  qty.textContent = fmtQty(v.quantita_disponibile, v.unita_misura);
  meta.appendChild(qty);

  const badge = calcolaBadgeScadenza(v.data_scadenza);
  if (badge) {
    const span = document.createElement('span');
    span.className = `badge ${badge.classe}`;
    span.textContent = badge.testo;
    meta.appendChild(span);
  }

  if (v.note) {
    const nota = document.createElement('span');
    nota.className = 'nota';
    nota.textContent = v.note;
    meta.appendChild(nota);
  }

  info.appendChild(nome);
  info.appendChild(meta);

  const autore = creaEtichettaAutore(v);
  if (autore) info.appendChild(autore);

  const btnLista = document.createElement('button');
  btnLista.className = 'btn-lista';
  btnLista.textContent = '+';
  btnLista.title = 'Rimetti in lista';
  btnLista.addEventListener('click', () => rimmettiInLista(v.id, btnLista));

  const btnElimina = document.createElement('button');
  btnElimina.className = 'btn-elimina';
  btnElimina.textContent = '✕';
  btnElimina.title = 'Elimina';
  btnElimina.addEventListener('click', () => eliminaVoceDispensa(v.id));

  li.appendChild(bar);
  li.appendChild(info);
  li.appendChild(btnLista);
  li.appendChild(btnElimina);
  return li;
}

async function rimmettiInLista(id, btn) {
  btn.disabled = true;
  const r = await apiFetch(`/api/dispensa/${id}/aggiungi-in-lista`, { method: 'POST' });
  if (!r) return;
  if (!r.ok) {
    btn.disabled = false;
    mostraErrore("Errore durante l'aggiunta in lista.");
    return;
  }
  btn.textContent = '✓';
  setTimeout(() => { btn.textContent = '+'; btn.disabled = false; }, 1500);
  if (r.status === 201) await caricaLista();
}

async function eliminaVoceDispensa(id) {
  const r = await apiFetch(`/api/dispensa/${id}`, { method: 'DELETE' });
  if (!r) return;
  if (!r.ok) { mostraErrore("Errore durante l'eliminazione."); return; }
  await caricaDispensa();
}

function apriModificaDispensa(li, v) {
  li.innerHTML = '';

  const form = document.createElement('form');
  form.className = 'form-inline';

  const inputNome = document.createElement('input');
  inputNome.type = 'text';
  inputNome.className = 'input-edit-nome';
  inputNome.value = v.nome;
  inputNome.required = true;
  inputNome.list = 'prodotti-datalist';

  const inputQty = document.createElement('input');
  inputQty.type = 'number';
  inputQty.className = 'input-edit-qty';
  inputQty.value = v.quantita_disponibile;
  inputQty.step = 'any';
  inputQty.min = '0';
  inputQty.required = true;

  const selCat   = creaSelectCategoria(v.categoria);
  const selUnita = creaSelectUnita(v.unita_misura);

  const inputScad = document.createElement('input');
  inputScad.type = 'date';
  inputScad.value = v.data_scadenza || '';

  const inputNote = document.createElement('input');
  inputNote.type = 'text';
  inputNote.className = 'input-edit-note';
  inputNote.value = v.note || '';
  inputNote.placeholder = 'Note';

  const btnSalva = document.createElement('button');
  btnSalva.type = 'submit';
  btnSalva.className = 'btn-salva';
  btnSalva.textContent = 'Salva';

  const btnAnnulla = document.createElement('button');
  btnAnnulla.type = 'button';
  btnAnnulla.className = 'btn-annulla';
  btnAnnulla.textContent = 'Ann.';
  btnAnnulla.addEventListener('click', () => li.replaceWith(creaElementoDispensa(v)));

  inputNome.addEventListener('input', () => aggiornaAutocomplete(inputNome, selCat, selUnita));

  form.append(inputNome, inputQty, selCat, selUnita, inputScad, inputNote, btnSalva, btnAnnulla);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const nome = inputNome.value.trim();
    const qty  = parseFloat(inputQty.value);
    if (!nome || isNaN(qty)) return;
    const r = await apiFetch(`/api/dispensa/${v.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome,
        quantita_disponibile: qty,
        categoria:    selCat.value,
        unita_misura: selUnita.value,
        data_scadenza: inputScad.value || null,
        note: inputNote.value.trim() || null,
      }),
    });
    if (!r) return;
    if (!r.ok) { mostraErrore('Errore durante il salvataggio.'); return; }
    await caricaDispensa();
  });

  li.appendChild(form);
  inputNome.focus();
}

document.getElementById('btn-svuota-dispensa').addEventListener('click', async () => {
  if (!confirm('Sei sicuro di voler cancellare TUTTA la dispensa?\n\nQuesta azione è irreversibile.')) return;
  const r = await apiFetch('/api/dispensa', { method: 'DELETE' });
  if (!r) return;
  if (!r.ok) { mostraErrore('Errore durante lo svuotamento della dispensa.'); return; }
  await caricaDispensa();
});

document.getElementById('form-dispensa').addEventListener('submit', async e => {
  e.preventDefault();
  const nome = document.getElementById('dispensa-nome').value.trim();
  const qty  = parseFloat(document.getElementById('dispensa-qty').value);
  const note = document.getElementById('dispensa-note').value.trim() || null;
  const scad = document.getElementById('dispensa-scadenza').value || null;
  if (!nome || isNaN(qty)) return;

  const r = await apiFetch('/api/dispensa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome,
      quantita_disponibile: qty,
      categoria:    document.getElementById('dispensa-categoria').value,
      unita_misura: document.getElementById('dispensa-unita').value,
      data_scadenza: scad,
      note,
    }),
  });
  if (!r) return;
  if (!r.ok) { mostraErrore("Errore durante l'aggiunta dell'articolo."); return; }

  document.getElementById('dispensa-nome').value     = '';
  document.getElementById('dispensa-qty').value      = '1';
  document.getElementById('dispensa-note').value     = '';
  document.getElementById('dispensa-scadenza').value = '';
  document.getElementById('dispensa-categoria').value = 'altro';
  document.getElementById('dispensa-unita').value     = 'pz';
  document.getElementById('dispensa-nome').focus();
  await caricaDispensa();
});

// Autocomplete sul form di aggiunta dispensa
document.getElementById('dispensa-nome').addEventListener('input', () => {
  aggiornaAutocomplete(
    document.getElementById('dispensa-nome'),
    document.getElementById('dispensa-categoria'),
    document.getElementById('dispensa-unita'),
  );
});

// --- Init ---

populateSelects();
caricaUtente();
caricaLista();
caricaDispensa();
