# Lista della Spesa

App per gestire la lista della spesa. Backend FastAPI + SQLite, frontend HTML/CSS/JS puro servito dallo stesso server.

## Avvio

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Apri http://127.0.0.1:8000

## API

- `GET /api/articoli` — lista articoli
- `POST /api/articoli` — crea articolo (`{"nome": "...", "quantita": "..."}`)
- `PATCH /api/articoli/{id}/comprato` — alterna stato comprato
- `DELETE /api/articoli/{id}` — elimina articolo
