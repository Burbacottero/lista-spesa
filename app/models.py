from typing import Literal

from pydantic import BaseModel, Field

CategoriaType = Literal[
    "frutta_verdura",
    "latticini",
    "carne_pesce",
    "dispensa_secca",
    "bevande",
    "surgelati",
    "casa_igiene",
    "altro",
]

UnitaType = Literal["pz", "g", "kg", "ml", "l", "conf"]

# Usato dal frontend tramite /api/categorie
CATEGORIE: dict[str, tuple[str, str]] = {
    "frutta_verdura": ("🥦", "Frutta e verdura"),
    "latticini":      ("🧀", "Latticini"),
    "carne_pesce":    ("🥩", "Carne e pesce"),
    "dispensa_secca": ("🫙", "Dispensa secca"),
    "bevande":        ("🧃", "Bevande"),
    "surgelati":      ("🧊", "Surgelati"),
    "casa_igiene":    ("🧼", "Casa e igiene"),
    "altro":          ("📦", "Altro"),
}

UNITA_MISURA: list[str] = ["pz", "g", "kg", "ml", "l", "conf"]


class Prodotto(BaseModel):
    id: int
    nome: str
    categoria: CategoriaType
    unita_misura: UnitaType


class VoceListaCreate(BaseModel):
    nome: str = Field(min_length=1, max_length=200)
    quantita_desiderata: float = Field(gt=0)
    categoria: CategoriaType = "altro"
    unita_misura: UnitaType = "pz"
    note: str | None = None


class Utente(BaseModel):
    id: int
    nome_visualizzato: str


class VoceLista(BaseModel):
    id: int
    prodotto_id: int
    nome: str
    categoria: CategoriaType
    unita_misura: UnitaType
    quantita_desiderata: float
    comprato: bool
    note: str | None
    aggiunto_da_nome: str | None = None
    comprato_da_nome: str | None = None


class VoceDispensaCreate(BaseModel):
    nome: str = Field(min_length=1, max_length=200)
    quantita_disponibile: float = Field(ge=0)
    categoria: CategoriaType = "altro"
    unita_misura: UnitaType = "pz"
    data_scadenza: str | None = None
    note: str | None = None


class VoceDispensa(BaseModel):
    id: int
    prodotto_id: int
    nome: str
    categoria: CategoriaType
    unita_misura: UnitaType
    quantita_disponibile: float
    data_scadenza: str | None
    note: str | None
    aggiunto_da_nome: str | None = None
    comprato_da_nome: str | None = None
