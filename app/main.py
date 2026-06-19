from dotenv import load_dotenv
load_dotenv()

from pathlib import Path

from fastapi import Depends, FastAPI, Form, HTTPException, Query, Request, Response
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.auth import COOKIE_NAME, crea_token, leggi_utente_id, richiedi_auth, verifica_password
from app.database import get_connection, init_db
from app.models import (
    CATEGORIE,
    UNITA_MISURA,
    Prodotto,
    Utente,
    VoceDispensa,
    VoceDispensaCreate,
    VoceLista,
    VoceListaCreate,
)

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(title="Lista della Spesa")


@app.on_event("startup")
def on_startup() -> None:
    init_db()


# --- Helper ---

def _trova_o_crea_prodotto(
    conn,
    nome: str,
    categoria: str,
    unita_misura: str,
) -> int:
    """Restituisce l'id del prodotto esistente (case-insensitive) o lo crea."""
    row = conn.execute(
        "SELECT id FROM prodotti WHERE nome = ? COLLATE NOCASE", (nome,)
    ).fetchone()
    if row:
        return row["id"]
    cursor = conn.execute(
        "INSERT INTO prodotti (nome, categoria, unita_misura) VALUES (?, ?, ?)",
        (nome, categoria, unita_misura),
    )
    return cursor.lastrowid


def _aggiorna_o_crea_prodotto(
    conn,
    current_prodotto_id: int,
    nome: str,
    categoria: str,
    unita_misura: str,
) -> int:
    """Come _trova_o_crea_prodotto, ma aggiorna anche categoria/unita_misura
    se il nome risolve allo stesso prodotto già collegato alla voce."""
    row = conn.execute(
        "SELECT id FROM prodotti WHERE nome = ? COLLATE NOCASE", (nome,)
    ).fetchone()
    if row:
        if row["id"] == current_prodotto_id:
            conn.execute(
                "UPDATE prodotti SET categoria = ?, unita_misura = ? WHERE id = ?",
                (categoria, unita_misura, row["id"]),
            )
        return row["id"]
    cursor = conn.execute(
        "INSERT INTO prodotti (nome, categoria, unita_misura) VALUES (?, ?, ?)",
        (nome, categoria, unita_misura),
    )
    return cursor.lastrowid


# Query base con JOIN — usata da tutti gli endpoint di lettura
_LISTA_SELECT = """
    SELECT vls.id, vls.prodotto_id, p.nome, p.categoria, p.unita_misura,
           vls.quantita_desiderata, vls.comprato, vls.note,
           ua.nome_visualizzato AS aggiunto_da_nome,
           uc.nome_visualizzato AS comprato_da_nome
    FROM voci_lista_spesa vls
    JOIN prodotti p ON p.id = vls.prodotto_id
    LEFT JOIN utenti ua ON ua.id = vls.aggiunto_da
    LEFT JOIN utenti uc ON uc.id = vls.comprato_da
"""

_DISPENSA_SELECT = """
    SELECT vd.id, vd.prodotto_id, p.nome, p.categoria, p.unita_misura,
           vd.quantita_disponibile, vd.data_scadenza, vd.note,
           ua.nome_visualizzato AS aggiunto_da_nome,
           uc.nome_visualizzato AS comprato_da_nome
    FROM voci_dispensa vd
    JOIN prodotti p ON p.id = vd.prodotto_id
    LEFT JOIN utenti ua ON ua.id = vd.aggiunto_da
    LEFT JOIN utenti uc ON uc.id = vd.comprato_da
"""


# --- Auth endpoints ---

@app.get("/login")
def serve_login(request: Request) -> Response:
    if leggi_utente_id(request) is not None:
        return RedirectResponse("/", status_code=302)
    return FileResponse(BASE_DIR / "templates" / "login.html")


@app.post("/login")
async def login_post(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
) -> Response:
    conn = get_connection()
    row = conn.execute(
        "SELECT id, password_hash FROM utenti WHERE username = ? COLLATE NOCASE",
        (username,),
    ).fetchone()
    conn.close()
    if row is None or not verifica_password(password, row["password_hash"]):
        return RedirectResponse("/login?err=1", status_code=303)
    token = crea_token(row["id"])
    resp = RedirectResponse("/", status_code=303)
    resp.set_cookie(
        COOKIE_NAME,
        token,
        httponly=True,
        samesite="lax",
        max_age=30 * 24 * 3600,
    )
    return resp


@app.post("/logout")
def logout() -> Response:
    resp = RedirectResponse("/login", status_code=303)
    resp.delete_cookie(COOKIE_NAME)
    return resp


@app.get("/api/me", response_model=Utente)
def get_me(utente_id: int = Depends(richiedi_auth)) -> dict:
    conn = get_connection()
    row = conn.execute(
        "SELECT id, nome_visualizzato FROM utenti WHERE id = ?", (utente_id,)
    ).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(status_code=401, detail="Utente non trovato")
    return dict(row)


# --- Lista della spesa ---

@app.get("/api/lista", response_model=list[VoceLista])
def get_lista(utente_id: int = Depends(richiedi_auth)) -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        _LISTA_SELECT + " ORDER BY p.categoria, p.nome"
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


@app.post("/api/lista", response_model=VoceLista, status_code=201)
def crea_voce_lista(voce: VoceListaCreate, utente_id: int = Depends(richiedi_auth)) -> dict:
    conn = get_connection()
    prodotto_id = _trova_o_crea_prodotto(conn, voce.nome, voce.categoria, voce.unita_misura)
    cursor = conn.execute(
        "INSERT INTO voci_lista_spesa (prodotto_id, quantita_desiderata, comprato, note, aggiunto_da)"
        " VALUES (?, ?, 0, ?, ?)",
        (prodotto_id, voce.quantita_desiderata, voce.note, utente_id),
    )
    conn.commit()
    row = conn.execute(
        _LISTA_SELECT + " WHERE vls.id = ?", (cursor.lastrowid,)
    ).fetchone()
    conn.close()
    return dict(row)


@app.delete("/api/lista", status_code=200)
def cancella_lista_intera(utente_id: int = Depends(richiedi_auth)) -> dict:
    conn = get_connection()
    result = conn.execute("DELETE FROM voci_lista_spesa")
    conn.commit()
    conn.close()
    return {"eliminati": result.rowcount}


@app.delete("/api/lista/comprati", status_code=200)
def cancella_comprati(utente_id: int = Depends(richiedi_auth)) -> dict:
    conn = get_connection()
    result = conn.execute("DELETE FROM voci_lista_spesa WHERE comprato = 1")
    conn.commit()
    conn.close()
    return {"eliminati": result.rowcount}


@app.delete("/api/lista/{voce_id}", status_code=204)
def cancella_voce_lista(voce_id: int, utente_id: int = Depends(richiedi_auth)) -> None:
    conn = get_connection()
    row = conn.execute(
        "SELECT id FROM voci_lista_spesa WHERE id = ?", (voce_id,)
    ).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Voce non trovata")
    conn.execute("DELETE FROM voci_lista_spesa WHERE id = ?", (voce_id,))
    conn.commit()
    conn.close()


@app.put("/api/lista/{voce_id}", response_model=VoceLista)
def aggiorna_voce_lista(
    voce_id: int, voce: VoceListaCreate, utente_id: int = Depends(richiedi_auth)
) -> dict:
    conn = get_connection()
    existing = conn.execute(
        "SELECT id, prodotto_id FROM voci_lista_spesa WHERE id = ?", (voce_id,)
    ).fetchone()
    if existing is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Voce non trovata")
    prodotto_id = _aggiorna_o_crea_prodotto(
        conn, existing["prodotto_id"], voce.nome, voce.categoria, voce.unita_misura
    )
    conn.execute(
        "UPDATE voci_lista_spesa"
        " SET prodotto_id = ?, quantita_desiderata = ?, note = ? WHERE id = ?",
        (prodotto_id, voce.quantita_desiderata, voce.note, voce_id),
    )
    conn.commit()
    row = conn.execute(
        _LISTA_SELECT + " WHERE vls.id = ?", (voce_id,)
    ).fetchone()
    conn.close()
    return dict(row)


@app.post(
    "/api/lista/{voce_id}/sposta-in-dispensa",
    response_model=VoceDispensa,
    status_code=201,
)
def sposta_in_dispensa(
    voce_id: int, response: Response, utente_id: int = Depends(richiedi_auth)
) -> dict:
    conn = get_connection()
    voce = conn.execute(
        "SELECT * FROM voci_lista_spesa WHERE id = ?", (voce_id,)
    ).fetchone()
    if voce is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Voce non trovata")

    prodotto_id = voce["prodotto_id"]

    # Voce già comprata: se esiste già in dispensa restituisce quella senza modificare nulla
    if voce["comprato"]:
        already = conn.execute(
            "SELECT id FROM voci_dispensa WHERE prodotto_id = ?", (prodotto_id,)
        ).fetchone()
        if already:
            row = conn.execute(
                _DISPENSA_SELECT + " WHERE vd.id = ?", (already["id"],)
            ).fetchone()
            conn.close()
            response.status_code = 200
            return dict(row)

    existing = conn.execute(
        "SELECT * FROM voci_dispensa WHERE prodotto_id = ?", (prodotto_id,)
    ).fetchone()

    if existing:
        nuova_qty = existing["quantita_disponibile"] + voce["quantita_desiderata"]
        conn.execute(
            "UPDATE voci_dispensa SET quantita_disponibile = ? WHERE id = ?",
            (nuova_qty, existing["id"]),
        )
        dispensa_id = existing["id"]
    else:
        cursor = conn.execute(
            "INSERT INTO voci_dispensa (prodotto_id, quantita_disponibile, aggiunto_da)"
            " VALUES (?, ?, ?)",
            (prodotto_id, voce["quantita_desiderata"], utente_id),
        )
        dispensa_id = cursor.lastrowid

    conn.execute(
        "UPDATE voci_lista_spesa SET comprato = 1, comprato_da = ? WHERE id = ?",
        (utente_id, voce_id),
    )
    conn.commit()
    row = conn.execute(
        _DISPENSA_SELECT + " WHERE vd.id = ?", (dispensa_id,)
    ).fetchone()
    conn.close()
    return dict(row)


# --- Dispensa ---

@app.get("/api/dispensa", response_model=list[VoceDispensa])
def get_dispensa(utente_id: int = Depends(richiedi_auth)) -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        _DISPENSA_SELECT + " ORDER BY p.categoria, p.nome"
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


@app.post("/api/dispensa", response_model=VoceDispensa, status_code=201)
def crea_voce_dispensa(voce: VoceDispensaCreate, utente_id: int = Depends(richiedi_auth)) -> dict:
    conn = get_connection()
    prodotto_id = _trova_o_crea_prodotto(conn, voce.nome, voce.categoria, voce.unita_misura)
    cursor = conn.execute(
        "INSERT INTO voci_dispensa"
        " (prodotto_id, quantita_disponibile, data_scadenza, note, aggiunto_da)"
        " VALUES (?, ?, ?, ?, ?)",
        (prodotto_id, voce.quantita_disponibile, voce.data_scadenza, voce.note, utente_id),
    )
    conn.commit()
    row = conn.execute(
        _DISPENSA_SELECT + " WHERE vd.id = ?", (cursor.lastrowid,)
    ).fetchone()
    conn.close()
    return dict(row)


@app.put("/api/dispensa/{voce_id}", response_model=VoceDispensa)
def aggiorna_voce_dispensa(
    voce_id: int, voce: VoceDispensaCreate, utente_id: int = Depends(richiedi_auth)
) -> dict:
    conn = get_connection()
    existing = conn.execute(
        "SELECT * FROM voci_dispensa WHERE id = ?", (voce_id,)
    ).fetchone()
    if existing is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Voce non trovata")

    prodotto_id = _aggiorna_o_crea_prodotto(
        conn, existing["prodotto_id"], voce.nome, voce.categoria, voce.unita_misura
    )

    # Se il prodotto risolto esiste già in dispensa con un id diverso: fondi
    collision = conn.execute(
        "SELECT * FROM voci_dispensa WHERE prodotto_id = ? AND id != ?",
        (prodotto_id, voce_id),
    ).fetchone()

    if collision:
        nuova_qty = collision["quantita_disponibile"] + voce.quantita_disponibile
        conn.execute(
            "UPDATE voci_dispensa SET quantita_disponibile = ? WHERE id = ?",
            (nuova_qty, collision["id"]),
        )
        conn.execute("DELETE FROM voci_dispensa WHERE id = ?", (voce_id,))
        result_id = collision["id"]
    else:
        conn.execute(
            "UPDATE voci_dispensa"
            " SET prodotto_id = ?, quantita_disponibile = ?, data_scadenza = ?, note = ?"
            " WHERE id = ?",
            (prodotto_id, voce.quantita_disponibile, voce.data_scadenza, voce.note, voce_id),
        )
        result_id = voce_id

    conn.commit()
    row = conn.execute(
        _DISPENSA_SELECT + " WHERE vd.id = ?", (result_id,)
    ).fetchone()
    conn.close()
    return dict(row)


@app.post(
    "/api/dispensa/{voce_id}/aggiungi-in-lista",
    response_model=VoceLista,
    status_code=201,
)
def aggiungi_in_lista(
    voce_id: int, response: Response, utente_id: int = Depends(richiedi_auth)
) -> dict:
    conn = get_connection()
    voce_dispensa = conn.execute(
        "SELECT * FROM voci_dispensa WHERE id = ?", (voce_id,)
    ).fetchone()
    if voce_dispensa is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Voce non trovata")

    prodotto_id = voce_dispensa["prodotto_id"]

    existing = conn.execute(
        "SELECT id FROM voci_lista_spesa WHERE prodotto_id = ? AND comprato = 0",
        (prodotto_id,),
    ).fetchone()

    if existing:
        row = conn.execute(
            _LISTA_SELECT + " WHERE vls.id = ?", (existing["id"],)
        ).fetchone()
        conn.close()
        response.status_code = 200
        return dict(row)

    cursor = conn.execute(
        "INSERT INTO voci_lista_spesa (prodotto_id, quantita_desiderata, comprato, aggiunto_da)"
        " VALUES (?, 1, 0, ?)",
        (prodotto_id, utente_id),
    )
    conn.commit()
    row = conn.execute(
        _LISTA_SELECT + " WHERE vls.id = ?", (cursor.lastrowid,)
    ).fetchone()
    conn.close()
    return dict(row)


@app.delete("/api/dispensa", status_code=200)
def svuota_dispensa(utente_id: int = Depends(richiedi_auth)) -> dict:
    conn = get_connection()
    result = conn.execute("DELETE FROM voci_dispensa")
    conn.commit()
    conn.close()
    return {"eliminati": result.rowcount}


@app.delete("/api/dispensa/{voce_id}", status_code=204)
def cancella_voce_dispensa(voce_id: int, utente_id: int = Depends(richiedi_auth)) -> None:
    conn = get_connection()
    row = conn.execute(
        "SELECT id FROM voci_dispensa WHERE id = ?", (voce_id,)
    ).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Voce non trovata")
    conn.execute("DELETE FROM voci_dispensa WHERE id = ?", (voce_id,))
    conn.commit()
    conn.close()


# --- Catalogo prodotti (autocomplete + metadati) ---

@app.get("/api/prodotti", response_model=list[Prodotto])
def cerca_prodotti(
    search: str = Query(default=""), utente_id: int = Depends(richiedi_auth)
) -> list[dict]:
    if not search.strip():
        return []
    conn = get_connection()
    rows = conn.execute(
        "SELECT id, nome, categoria, unita_misura FROM prodotti"
        " WHERE nome LIKE ? COLLATE NOCASE ORDER BY nome LIMIT 10",
        (f"%{search}%",),
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


@app.get("/api/categorie")
def get_categorie(utente_id: int = Depends(richiedi_auth)) -> dict:
    return {
        key: {"emoji": emoji, "label": label}
        for key, (emoji, label) in CATEGORIE.items()
    }


app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")


@app.get("/")
def serve_index(request: Request) -> Response:
    if leggi_utente_id(request) is None:
        return RedirectResponse("/login", status_code=302)
    return FileResponse(BASE_DIR / "templates" / "index.html")
