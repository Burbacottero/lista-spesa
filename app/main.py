from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.database import get_connection, init_db
from app.models import VoceDispensa, VoceDispensaCreate, VoceLista, VoceListaCreate

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(title="Lista della Spesa")


@app.on_event("startup")
def on_startup() -> None:
    init_db()


# --- Lista della spesa ---

@app.get("/api/lista", response_model=list[VoceLista])
def get_lista() -> list[dict]:
    conn = get_connection()
    rows = conn.execute("SELECT * FROM voci_lista_spesa ORDER BY id").fetchall()
    conn.close()
    return [dict(row) for row in rows]


@app.post("/api/lista", response_model=VoceLista, status_code=201)
def crea_voce_lista(voce: VoceListaCreate) -> dict:
    conn = get_connection()
    cursor = conn.execute(
        "INSERT INTO voci_lista_spesa (nome, quantita_desiderata, comprato, note) VALUES (?, ?, 0, ?)",
        (voce.nome, voce.quantita_desiderata, voce.note),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM voci_lista_spesa WHERE id = ?", (cursor.lastrowid,)
    ).fetchone()
    conn.close()
    return dict(row)


@app.patch("/api/lista/{voce_id}/comprato", response_model=VoceLista)
def toggle_comprato(voce_id: int) -> dict:
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM voci_lista_spesa WHERE id = ?", (voce_id,)
    ).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Voce non trovata")
    nuovo_stato = 0 if row["comprato"] else 1
    conn.execute(
        "UPDATE voci_lista_spesa SET comprato = ? WHERE id = ?", (nuovo_stato, voce_id)
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM voci_lista_spesa WHERE id = ?", (voce_id,)
    ).fetchone()
    conn.close()
    return dict(row)


@app.delete("/api/lista/{voce_id}", status_code=204)
def cancella_voce_lista(voce_id: int) -> None:
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


@app.post("/api/lista/{voce_id}/sposta-in-dispensa", response_model=VoceDispensa)
def sposta_in_dispensa(voce_id: int) -> dict:
    conn = get_connection()
    voce = conn.execute(
        "SELECT * FROM voci_lista_spesa WHERE id = ?", (voce_id,)
    ).fetchone()
    if voce is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Voce non trovata")

    existing = conn.execute(
        "SELECT * FROM voci_dispensa WHERE nome = ? COLLATE NOCASE", (voce["nome"],)
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
            "INSERT INTO voci_dispensa (nome, quantita_disponibile, note) VALUES (?, ?, NULL)",
            (voce["nome"], voce["quantita_desiderata"]),
        )
        dispensa_id = cursor.lastrowid

    conn.execute("DELETE FROM voci_lista_spesa WHERE id = ?", (voce_id,))
    conn.commit()
    row = conn.execute(
        "SELECT * FROM voci_dispensa WHERE id = ?", (dispensa_id,)
    ).fetchone()
    conn.close()
    return dict(row)


# --- Dispensa ---

@app.get("/api/dispensa", response_model=list[VoceDispensa])
def get_dispensa() -> list[dict]:
    conn = get_connection()
    rows = conn.execute("SELECT * FROM voci_dispensa ORDER BY id").fetchall()
    conn.close()
    return [dict(row) for row in rows]


@app.post("/api/dispensa", response_model=VoceDispensa, status_code=201)
def crea_voce_dispensa(voce: VoceDispensaCreate) -> dict:
    conn = get_connection()
    cursor = conn.execute(
        "INSERT INTO voci_dispensa (nome, quantita_disponibile, note) VALUES (?, ?, ?)",
        (voce.nome, voce.quantita_disponibile, voce.note),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM voci_dispensa WHERE id = ?", (cursor.lastrowid,)
    ).fetchone()
    conn.close()
    return dict(row)


@app.delete("/api/dispensa/{voce_id}", status_code=204)
def cancella_voce_dispensa(voce_id: int) -> None:
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


app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")


@app.get("/")
def serve_index() -> FileResponse:
    return FileResponse(BASE_DIR / "templates" / "index.html")
