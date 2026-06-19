#!/usr/bin/env python3
"""Crea un nuovo utente nel database dell'app lista-spesa.

Uso:
    python scripts/crea_utente.py
"""
import getpass
import sqlite3
import sys
from pathlib import Path

import bcrypt

DB_PATH = Path(__file__).resolve().parent.parent / "lista_spesa.db"


def main() -> None:
    if not DB_PATH.exists():
        print(f"Errore: database non trovato in {DB_PATH}")
        print("Avvia l'app almeno una volta per inizializzare il database.")
        sys.exit(1)

    username = input("Username: ").strip()
    if not username:
        print("Errore: lo username non può essere vuoto.")
        sys.exit(1)

    password = getpass.getpass("Password: ")
    if not password:
        print("Errore: la password non può essere vuota.")
        sys.exit(1)

    nome = input("Nome visualizzato (es. Monica, Nicola, Alessandro): ").strip()
    if not nome:
        print("Errore: il nome visualizzato non può essere vuoto.")
        sys.exit(1)

    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute(
            "INSERT INTO utenti (username, password_hash, nome_visualizzato) VALUES (?, ?, ?)",
            (username, password_hash, nome),
        )
        conn.commit()
        print(f'\nUtente "{nome}" (username: {username}) creato con successo.')
    except sqlite3.IntegrityError:
        print(f'Errore: lo username "{username}" è già in uso.')
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
