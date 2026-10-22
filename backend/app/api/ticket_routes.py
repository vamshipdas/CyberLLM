from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_any_user
from app.db import get_db
from app.models.db_models import Ticket, User
from app.models.schemas import TicketOut, TicketStatusUpdate
from app.services.ticket_service import ticket_service

router = APIRouter(prefix="/tickets", tags=["SOC Tickets"])


@router.get("", response_model=List[TicketOut])
def list_tickets(
    db: Session = Depends(get_db),
    _: User = Depends(require_any_user),
) -> List[TicketOut]:
    rows = ticket_service.get_all(db)
    return [
        TicketOut(
            id=r.id,
            title=r.title,
            threat_type=r.threat_type,
            severity=r.severity,
            status=r.status,
            source_ip=r.source_ip,
            target_host=r.target_host,
            description=r.description,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.get("/open", response_model=List[TicketOut])
def open_tickets(
    db: Session = Depends(get_db),
    _: User = Depends(require_any_user),
) -> List[TicketOut]:
    rows = ticket_service.get_open(db)
    return [
        TicketOut(
            id=r.id,
            title=r.title,
            threat_type=r.threat_type,
            severity=r.severity,
            status=r.status,
            source_ip=r.source_ip,
            target_host=r.target_host,
            description=r.description,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.patch("/{ticket_id}/status", response_model=TicketOut)
def update_ticket_status(
    ticket_id: str,
    update: TicketStatusUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_user),
) -> Ticket:
    ticket = ticket_service.update_status(db, ticket_id, update.status)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket
