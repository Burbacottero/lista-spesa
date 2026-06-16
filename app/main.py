from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.database import get_connection, init_db
from app.models import Articolo, ArticoloCreate

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(title="Lista della Spesa")


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/api/articoli", response_model=list[Articolo])
def get_articoli() -> list[dict]:
    conn = get_connection()
    rows = conn.execute("SELECT * FROM articoli ORDER BY id").fetchall()
    conn.close()
    return [dict(row) for row in rows]


@app.post("/api/articoli", response_model=Articolo, status_code=201)
def crea_articolo(articolo: ArticoloCreate) -> dict:
    conn = get_connection()
    cursor = conn.execute(
        "INSERT INTO articoli (nome, quantita, comprato) VALUES (?, ?, 0)",
        (articolo.nome, articolo.quantita),
    )
    conn.commit()
    nuovo_id = cursor.lastrowid
    row = conn.execute("SELECT * FROM articoli WHERE id = ?", (nuovo_id,)).fetchone()
    conn.close()
    return dict(row)


@app.patch("/api/articoli/{articolo_id}/comprato", response_model=Articolo)
def toggle_comprato(articolo_id: int) -> dict:
    conn = get_connection()
    row = conn.execute("SELECT * FROM articoli WHERE id = ?", (articolo_id,)).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Articolo non trovato")

    nuovo_stato = 0 if row["comprato"] else 1
    conn.execute("UPDATE articoli SET comprato = ? WHERE id = ?", (nuovo_stato, articolo_id))
    conn.commit()
    row = conn.execute("SELECT * FROM articoli WHERE id = ?", (articolo_id,)).fetchone()
    conn.close()
    return dict(row)


@app.delete("/api/articoli/{articolo_id}", status_code=204)
def cancella_articolo(articolo_id: int) -> None:
    conn = get_connection()
    row = conn.execute("SELECT id FROM articoli WHERE id = ?", (articolo_id,)).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Articolo non trovato")

    conn.execute("DELETE FROM articoli WHERE id = ?", (articolo_id,))
    conn.commit()
    conn.close()


app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")


@app.get("/")
def serve_index() -> FileResponse:
    return FileResponse(BASE_DIR / "templates" / "index.html")
