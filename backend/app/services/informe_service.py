"""Lógica de negocio de informes."""
from uuid import UUID

from fastapi import HTTPException, status
from supabase import Client


def get_informe_or_404(client: Client, informe_id: str | UUID, medico_id: str) -> dict:
    """Carga un informe verificando que pertenece al médico. Lanza 404 si no existe."""
    try:
        result = (
            client.table("informes")
            .select("*")
            .eq("id", str(informe_id))
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Informe no encontrado")

    informe = result.data
    if not informe or informe.get("medico_id") != str(medico_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Informe no encontrado")

    return informe


def assert_borrador(informe: dict) -> None:
    """Verifica que el informe está en estado borrador. Lanza 409 si ya está finalizado."""
    if informe.get("estado") != "borrador":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El informe ya está finalizado y no puede modificarse",
        )
