from datetime import date, datetime

from django.db.models import Subquery, Sum

from projects.models import RepositoryLanguage

from .models import TrendingRepository, TrendingRepositorySelection

INITIAL_LANGUAGES = (
    "Python",
    "JavaScript",
    "TypeScript",
    "Java",
    "C++",
)


def list_collection_languages(
    *,
    excluded_languages: set[str],
) -> list[str]:
    """Repository 사용량 또는 초기 목록에서 수집 언어를 반환한다.

    제외 언어를 제거한 뒤 저장된 언어가 5개 이상이면 bytes 합계 상위
    5개를 반환한다. 5개 미만이면 부족분을 보충하지 않고 초기 언어
    목록으로 대체한다.
    """
    excluded = {language.casefold() for language in excluded_languages}
    language_totals = (
        RepositoryLanguage.objects.values("language")
        .annotate(total_bytes=Sum("bytes"))
        .order_by("-total_bytes", "language")
    )
    available = [
        item["language"]
        for item in language_totals
        if item["language"].casefold() not in excluded
    ]
    if len(available) >= 5:
        return available[:5]
    return [
        language
        for language in INITIAL_LANGUAGES
        if language.casefold() not in excluded
    ]


def has_successful_selection(week_start: date) -> bool:
    """해당 주의 정상 수집 완료 여부를 반환한다."""
    return TrendingRepositorySelection.objects.filter(
        week_start=week_start
    ).exists()


def list_recent_github_ids(selected_after: datetime) -> set[int]:
    """기준 시각 이후 노출된 GitHub Repository ID를 반환한다."""
    return set(
        TrendingRepository.objects.filter(
            selection__created_at__gte=selected_after
        )
        .values_list("github_id", flat=True)
    )


def list_trending_repositories() -> list[TrendingRepository]:
    """가장 최근 선정에 포함된 Repository를 순위대로 조회한다."""
    latest_selection = (
        TrendingRepositorySelection.objects.order_by("-week_start")
        .values("pk")[:1]
    )
    return list(
        TrendingRepository.objects.filter(
            selection_id=Subquery(latest_selection),
        ).order_by("position", "github_id")[:10]
    )
