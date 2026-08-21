from calendar import monthrange
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from celery import chain, shared_task
from django.conf import settings

from users.tasks import daily_update

from .services import (
    calculate_project_rankings,
    calculate_user_rankings,
    replace_daily_rankings,
)


def _one_year_before(target_date: date) -> date:
    try:
        return target_date.replace(year=target_date.year - 1)
    except ValueError:
        return target_date.replace(year=target_date.year - 1, day=28)


def _months_before(target_date: date, months: int) -> date:
    """달력 기준으로 지정한 개월 수 전의 날짜를 반환한다."""
    month_index = target_date.year * 12 + target_date.month - 1 - months
    year, zero_based_month = divmod(month_index, 12)
    month = zero_based_month + 1
    day = min(target_date.day, monthrange(year, month)[1])
    return target_date.replace(year=year, month=month, day=day)


@shared_task
def calculate_daily_rankings(
    period_end: str | None = None,
) -> int:
    """지정일 또는 서비스 기준 전날의 저장 랭킹을 계산한다.

    Args:
        period_end: ISO 8601 형식의 집계 종료일. 없으면 서비스 날짜의 전날.

    Returns:
        DB에 저장한 1년·6개월 랭킹 결과 수.
    """
    target_date = (
        date.fromisoformat(period_end)
        if period_end
        else datetime.now(ZoneInfo(settings.CELERY_TIMEZONE)).date()
        - timedelta(days=1)
    )
    six_month_period_start = _months_before(target_date, 6)
    one_year_projects = calculate_project_rankings(
        _one_year_before(target_date),
        target_date,
    )
    six_month_projects = calculate_project_rankings(
        six_month_period_start,
        target_date,
    )
    six_month_users = calculate_user_rankings(
        six_month_period_start,
        target_date,
    )
    replace_daily_rankings(
        one_year_projects=one_year_projects,
        six_month_projects=six_month_projects,
        six_month_users=six_month_users,
        six_month_period_start=six_month_period_start,
        period_end=target_date,
    )
    return (
        len(one_year_projects)
        + len(six_month_projects)
        + len(six_month_users)
    )


@shared_task
def refresh_users_and_calculate_rankings() -> None:
    """사용자 활동 갱신 후 일별 랭킹 계산을 순서대로 예약한다.

    사용자 갱신이 성공한 경우에만 랭킹 계산을 실행한다. Immutable signature를
    사용해 사용자 갱신 결과가 랭킹 집계 종료일로 전달되지 않게 한다.
    """
    chain(
        daily_update.si(),
        calculate_daily_rankings.si(),
    ).apply_async()
