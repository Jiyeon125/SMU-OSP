"""공통 API 응답 wrapper.

성공:
    { "status": "SUCCESS", "data": {...}, "detail": null, "timestamp": "..." }
실패:
    { "status": "FAIL", "data": null, "detail": {code, message}, "timestamp": "..." }

HTTP status와 body의 status는 분리한다.
body.status는 SUCCESS / FAIL 의 두 값만 사용한다.
"""

from datetime import datetime, timezone

from rest_framework import status as http_status
from rest_framework.response import Response


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def success(data=None, http: int = http_status.HTTP_200_OK) -> Response:
    return Response(
        {
            "status": "SUCCESS",
            "data": data if data is not None else {},
            "detail": None,
            "timestamp": _now_iso(),
        },
        status=http,
    )


def fail(code: str, message: str, http: int = http_status.HTTP_400_BAD_REQUEST) -> Response:
    return Response(
        {
            "status": "FAIL",
            "data": None,
            "detail": {"code": code, "message": message},
            "timestamp": _now_iso(),
        },
        status=http,
    )
