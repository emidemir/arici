# config/exception_handler.py
#
# Before this file existed, the project used DRF's default exception
# handling untouched. That's mostly fine for *expected* API errors
# (ValidationError, NotFound, PermissionDenied, ...) — DRF already builds a
# reasonable response for those. The actual problem was everything else:
# any exception DRF doesn't recognise (a bare ValueError, a database error,
# an Elasticsearch/Redis client error, ...) makes `exception_handler()`
# return None, and — with no LOGGING configured (see settings.py) and DEBUG
# off — that unhandled exception produced a bare 500 with absolutely no
# record of it anywhere. This wraps the default handler so:
#
#   1. Every exception that reaches a view is logged somewhere, always.
#   2. Unexpected/unrecognised exceptions get a clean, generic JSON body
#      instead of leaking a stack trace or returning nothing useful.
#   3. Exceptions DRF already knows how to handle keep their existing
#      response shape untouched, so nothing on the frontend that parses
#      `detail` / `non_field_errors` / per-field arrays breaks.

import logging

from rest_framework.views import exception_handler as drf_exception_handler
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)

    request = context.get('request')
    view = context.get('view')
    method = getattr(request, 'method', '?')
    path = getattr(request, 'path', 'unknown path')
    view_name = view.__class__.__name__ if view is not None else 'unknown view'

    if response is not None:
        # DRF recognised this exception and already built a sensible
        # response (validation errors, 404s, permission/auth failures,
        # throttling, ...). Log it for visibility — server errors a bit
        # louder than client errors — and return DRF's response as-is.
        level = logging.WARNING if response.status_code >= 500 else logging.INFO
        logger.log(
            level,
            "%s %s -> %s (%s): %s",
            method, path, response.status_code, view_name, response.data,
        )
        return response

    # DRF didn't recognise this exception at all, which means it would
    # otherwise propagate up as a completely unhandled 500 — invisible to
    # anyone except someone tailing a raw traceback. Log the full traceback
    # now, then return a clean, generic body instead of leaking internals
    # (the real detail is in the logs, not the HTTP response).
    logger.exception(
        "Unhandled exception in %s %s (%s)", method, path, view_name,
    )

    return Response(
        {"detail": "An unexpected error occurred. Please try again later."},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
