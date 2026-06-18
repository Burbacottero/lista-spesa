import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "lista_spesa.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_connection()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS voci_lista_spesa (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            quantita_desiderata REAL NOT NULL DEFAULT 1.0,
            comprato INTEGER NOT NULL DEFAULT 0,
            note TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS voci_dispensa (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            quantita_disponibile REAL NOT NULL DEFAULT 0.0,
            note TEXT
        )
    """)

    # Migrazione dalla vecchia tabella articoli
    old_table = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='articoli'"
    ).fetchone()

    if old_table:
        count = conn.execute("SELECT COUNT(*) FROM voci_lista_spesa").fetchone()[0]
        if count == 0:
            conn.execute("""
                INSERT INTO voci_lista_spesa (nome, quantita_desiderata, comprato, note)
                SELECT nome, CAST(quantita AS REAL), comprato, NULL
                FROM articoli
            """)
        conn.execute("DROP TABLE articoli")

    conn.commit()
    conn.close()
