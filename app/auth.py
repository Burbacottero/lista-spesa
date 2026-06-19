import logging
import os
import secrets

import bcrypt
from fastapi import HTTPException, Request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

logger = logging.getLogger(__name__)

COOKIE_NAME = "session"
_MAX_AGE = 30 * 24 * 3600  # 30 giorni


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verifica_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

_signer: URLSafeTimedSerializer | None = None


def _get_signer() -> URLSafeTimedSerializer:
    global _signer
    if _signer is None:
        key = os.environ.get("SECRET_KEY")
        if not key:
            key = secrets.token_hex(32)
            logger.warning(
                "SECRET_KEY non impostata: uso chiave casuale. "
                "Le sessioni saranno invalidate ad ogni riavvio. "
                "Imposta SECRET_KEY nel tuo ambiente per la produzione."
            )
        _signer = URLSafeTimedSerializer(key)
    return _signer


def crea_token(utente_id: int) -> str:
    return _get_signer().dumps({"uid": utente_id})


def leggi_utente_id(request: Request) -> int | None:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    try:
        data = _get_signer().loads(token, max_age=_MAX_AGE)
        return int(data["uid"])
    except (BadSignature, SignatureExpired, KeyError, ValueError):
        return None


def richiedi_auth(request: Request) -> int:
    """Dipendenza FastAPI per endpoint API: restituisce utente_id o solleva 401."""
    uid = leggi_utente_id(request)
    if uid is None:
        raise HTTPException(status_code=401, detail="Non autenticato")
    return uid
