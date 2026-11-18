"""
Rotas de Categorias de Produtos (MS Warehouse).
"""

from typing import List

from fastapi import APIRouter
from pydantic import BaseModel

from shared.database import get_db

router = APIRouter(prefix="/categories", tags=["Categorias"])


class CategoryOut(BaseModel):
    id: str
    label: str
    has_expiry: bool = False


@router.get("", response_model=List[CategoryOut])
async def list_categories():
    """Retorna as categorias padrão do catálogo."""
    db = get_db("warehouse")
    try:
        resp = db.table("categories").select("id, label, has_expiry").execute()
        rows = resp.data if resp and resp.data else []
        return [CategoryOut(**r) for r in rows]
    except Exception:
        # Fallback seguro com as 5 categorias canônicas
        return [
            CategoryOut(id="perecivel", label="Perecível (Alimentos)", has_expiry=True),
            CategoryOut(id="moda", label="Vestuário & Moda", has_expiry=False),
            CategoryOut(id="livros", label="Livros", has_expiry=False),
            CategoryOut(id="eletronicos", label="Eletrônicos", has_expiry=False),
            CategoryOut(id="outros", label="Outros", has_expiry=False),
        ]
