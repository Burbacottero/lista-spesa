import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "lista_spesa.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _aggiungi_colonna_se_mancante(
    conn: sqlite3.Connection, tabella: str, colonna: str, definizione: str
) -> None:
    cols = {row[1] for row in conn.execute(f"PRAGMA table_info({tabella})").fetchall()}
    if colonna not in cols:
        conn.execute(f"ALTER TABLE {tabella} ADD COLUMN {colonna} {definizione}")


def init_db() -> None:
    conn = get_connection()

    # Catalogo centrale prodotti
    conn.execute("""
        CREATE TABLE IF NOT EXISTS prodotti (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            nome         TEXT NOT NULL,
            categoria    TEXT NOT NULL DEFAULT 'altro',
            unita_misura TEXT NOT NULL DEFAULT 'pz',
            UNIQUE(nome COLLATE NOCASE)
        )
    """)

    # Rileva la versione dello schema da voci_lista_spesa
    lista_cols = {
        row[1]
        for row in conn.execute("PRAGMA table_info(voci_lista_spesa)").fetchall()
    }

    if not lista_cols:
        # DB nuovo: crea tabelle con schema aggiornato
        conn.execute("""
            CREATE TABLE voci_lista_spesa (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                prodotto_id         INTEGER NOT NULL REFERENCES prodotti(id),
                quantita_desiderata REAL NOT NULL DEFAULT 1.0,
                comprato            INTEGER NOT NULL DEFAULT 0,
                note                TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE voci_dispensa (
                id                   INTEGER PRIMARY KEY AUTOINCREMENT,
                prodotto_id          INTEGER NOT NULL REFERENCES prodotti(id),
                quantita_disponibile REAL NOT NULL DEFAULT 0.0,
                data_scadenza        TEXT,
                note                 TEXT
            )
        """)

    elif "nome" in lista_cols:
        # Schema vecchio (nome diretto): esegui migrazione

        # a. Popola prodotti da entrambe le tabelle; UNIQUE COLLATE NOCASE deduplica
        conn.execute("""
            INSERT OR IGNORE INTO prodotti (nome)
            SELECT DISTINCT nome FROM voci_lista_spesa
        """)
        conn.execute("""
            INSERT OR IGNORE INTO prodotti (nome)
            SELECT DISTINCT nome FROM voci_dispensa
        """)

        # b. Ricrea voci_lista_spesa con prodotto_id FK
        conn.execute("""
            CREATE TABLE voci_lista_spesa_new (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                prodotto_id         INTEGER NOT NULL REFERENCES prodotti(id),
                quantita_desiderata REAL NOT NULL DEFAULT 1.0,
                comprato            INTEGER NOT NULL DEFAULT 0,
                note                TEXT
            )
        """)
        conn.execute("""
            INSERT INTO voci_lista_spesa_new
                (id, prodotto_id, quantita_desiderata, comprato, note)
            SELECT vls.id, p.id, vls.quantita_desiderata, vls.comprato, vls.note
            FROM voci_lista_spesa vls
            JOIN prodotti p ON lower(p.nome) = lower(vls.nome)
        """)
        conn.execute("DROP TABLE voci_lista_spesa")
        conn.execute("ALTER TABLE voci_lista_spesa_new RENAME TO voci_lista_spesa")

        # c. Ricrea voci_dispensa con prodotto_id FK + data_scadenza
        conn.execute("""
            CREATE TABLE voci_dispensa_new (
                id                   INTEGER PRIMARY KEY AUTOINCREMENT,
                prodotto_id          INTEGER NOT NULL REFERENCES prodotti(id),
                quantita_disponibile REAL NOT NULL DEFAULT 0.0,
                data_scadenza        TEXT,
                note                 TEXT
            )
        """)
        conn.execute("""
            INSERT INTO voci_dispensa_new
                (id, prodotto_id, quantita_disponibile, note)
            SELECT vd.id, p.id, vd.quantita_disponibile, vd.note
            FROM voci_dispensa vd
            JOIN prodotti p ON lower(p.nome) = lower(vd.nome)
        """)
        conn.execute("DROP TABLE voci_dispensa")
        conn.execute("ALTER TABLE voci_dispensa_new RENAME TO voci_dispensa")

    # else: prodotto_id già presente — schema corrente, niente da fare

    # Migrazione dalla tabella articoli (primissima versione dell'app)
    old_table = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='articoli'"
    ).fetchone()

    if old_table:
        conn.execute("""
            INSERT OR IGNORE INTO prodotti (nome)
            SELECT DISTINCT nome FROM articoli
        """)
        count = conn.execute("SELECT COUNT(*) FROM voci_lista_spesa").fetchone()[0]
        if count == 0:
            conn.execute("""
                INSERT INTO voci_lista_spesa (prodotto_id, quantita_desiderata, comprato)
                SELECT p.id, CAST(a.quantita AS REAL), a.comprato
                FROM articoli a
                JOIN prodotti p ON lower(p.nome) = lower(a.nome)
            """)
        conn.execute("DROP TABLE articoli")

    # --- Autenticazione: tabella utenti e colonne di tracciamento ---

    conn.execute("""
        CREATE TABLE IF NOT EXISTS utenti (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            username          TEXT NOT NULL UNIQUE,
            password_hash     TEXT NOT NULL,
            nome_visualizzato TEXT NOT NULL,
            creato_il         TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)

    _aggiungi_colonna_se_mancante(
        conn, "voci_lista_spesa", "aggiunto_da", "INTEGER REFERENCES utenti(id)"
    )
    _aggiungi_colonna_se_mancante(
        conn, "voci_lista_spesa", "comprato_da", "INTEGER REFERENCES utenti(id)"
    )
    _aggiungi_colonna_se_mancante(
        conn, "voci_dispensa", "aggiunto_da", "INTEGER REFERENCES utenti(id)"
    )
    _aggiungi_colonna_se_mancante(
        conn, "voci_dispensa", "comprato_da", "INTEGER REFERENCES utenti(id)"
    )

    conn.commit()
    conn.close()
