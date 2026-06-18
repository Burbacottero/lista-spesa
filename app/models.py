from pydantic import BaseModel, Field


class VoceListaCreate(BaseModel):
    nome: str = Field(min_length=1, max_length=200)
    quantita_desiderata: float = Field(gt=0)
    note: str | None = None


class VoceLista(VoceListaCreate):
    id: int
    comprato: bool


class VoceDispensaCreate(BaseModel):
    nome: str = Field(min_length=1, max_length=200)
    quantita_disponibile: float = Field(ge=0)
    note: str | None = None


class VoceDispensa(VoceDispensaCreate):
    id: int
