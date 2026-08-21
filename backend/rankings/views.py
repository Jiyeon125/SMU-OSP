from calendar import monthrange
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from common.pagination import pagination_detail
from common.responses import fail, success

from .forms import RankingQueryForm
from .selectors import list_project_rankings
from .serializers import (
    ProjectRankingResultSerializer,
    UserRankingResultSerializer,
)
from .services import calculate_project_rankings, calculate_user_rankings


def _months_before(target_date: date, months: int) -> date:
    """달력 기준으로 지정한 개월 수 전의 날짜를 반환한다."""
    month_index = target_date.year * 12 + target_date.month - 1 - months
    year, zero_based_month = divmod(month_index, 12)
    month = zero_based_month + 1
    day = min(target_date.day, monthrange(year, month)[1])
    return target_date.replace(year=year, month=month, day=day)


def _ranking_period_dates(period: str) -> tuple[date, date]:
    """서비스 기준 전날을 종료일로 하는 랭킹 집계 기간을 반환한다."""
    period_end = (
        datetime.now(ZoneInfo(settings.CELERY_TIMEZONE)).date()
        - timedelta(days=1)
    )
    months = 6 if period == "6m" else 12
    return _months_before(period_end, months), period_end


def _invalid_query_response(query_form: RankingQueryForm) -> Response:
    if "period" in query_form.errors:
        code = "INVALID_RANKING_PERIOD"
        message = "period는 6m 또는 1y여야 합니다."
    else:
        code = "INVALID_PAGINATION_PARAMETER"
        message = "start는 0 이상, limit은 1 이상 100 이하여야 합니다."
    return Response(
        fail(code, message, status.HTTP_400_BAD_REQUEST),
        status=status.HTTP_400_BAD_REQUEST,
    )


class UserRankings(APIView):
    """선택한 기간의 사용자 랭킹을 제공한다."""

    def get(self, request):
        """사용자 랭킹 목록을 반환한다."""
        query_form = RankingQueryForm(request.query_params)
        if not query_form.is_valid():
            return _invalid_query_response(query_form)
        query = query_form.to_query()
        period_start, period_end = _ranking_period_dates(query.period)
        rankings = calculate_user_rankings(period_start, period_end)
        results = rankings[query.start : query.start + query.limit]
        return Response(
            success(
                UserRankingResultSerializer(results, many=True).data,
                pagination_detail(
                    query.start,
                    query.limit,
                    len(rankings),
                ),
            ),
            status=status.HTTP_200_OK,
        )


class ProjectRankings(APIView):
    """선택한 기간의 프로젝트 랭킹을 제공한다."""

    def get(self, request):
        """프로젝트 랭킹 목록을 반환한다."""
        query_form = RankingQueryForm(request.query_params)
        if not query_form.is_valid():
            return _invalid_query_response(query_form)
        query = query_form.to_query()
        if query.period == "1y":
            results, count = list_project_rankings(
                start=query.start,
                limit=query.limit,
            )
        else:
            period_start, period_end = _ranking_period_dates(query.period)
            rankings = calculate_project_rankings(period_start, period_end)
            count = len(rankings)
            results = rankings[query.start : query.start + query.limit]
        return Response(
            success(
                ProjectRankingResultSerializer(results, many=True).data,
                pagination_detail(query.start, query.limit, count),
            ),
            status=status.HTTP_200_OK,
        )
