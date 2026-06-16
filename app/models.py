from pydantic import BaseModel, Field


class ArticoloCreate(BaseModel):
    nome: str = Field(min_length=1, max_length=200)
    quantita: str = Field(min_length=1, max_length=50)


class Articolo(ArticoloCreate):
    id: int
    comprato: bool
