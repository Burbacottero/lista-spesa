import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "lista_spesa.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_connection()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS articoli (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            quantita TEXT NOT NULL,
            comprato INTEGER NOT NULL DEFAULT 0
        )
        """
    )
    conn.commit()
    conn.close()
