"""
Utility functions for the audit/bitacora module.
Use log_action() from any view or signal to persist a record.
"""
import logging

logger = logging.getLogger(__name__)


def log_action(*, accion: str, modulo: str, descripcion: str,
               usuario_id=None, usuario_nombre: str = '', usuario_rol: str = '',
               ip_address=None):
    """Insert one audit row via raw SQL (bypasses managed=False ORM write limitations)."""
    from django.db import connection
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "INSERT INTO bitacora "
                "(usuario_id, usuario_nombre, usuario_rol, accion, modulo, descripcion, ip_address, fecha) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())",
                [usuario_id, usuario_nombre or '', usuario_rol or '',
                 accion, modulo, descripcion, ip_address],
            )
    except Exception as exc:
        logger.error(f'Bitacora insert failed: {exc}')


def actor_from_request(request) -> dict:
    """Extract actor info from JWT claims attached to the request."""
    if request.auth:
        return {
            'usuario_id':     request.auth.get('user_id'),
            'usuario_nombre': request.auth.get('name') or request.auth.get('username', ''),
            'usuario_rol':    request.auth.get('role', ''),
            'ip_address':     request.META.get('REMOTE_ADDR'),
        }
    return {
        'usuario_id':     None,
        'usuario_nombre': 'Anónimo',
        'usuario_rol':    '',
        'ip_address':     request.META.get('REMOTE_ADDR'),
    }
