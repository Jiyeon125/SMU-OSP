from datetime import date, datetime, timedelta

from django.conf import settings
from django.db import transaction

from .github_client import (
    TrendingRepositoryCandidate,
    search_trending_repositories,
)
from .models import TrendingRepository, TrendingRepositorySelection
from .selectors import (
    has_successful_selection,
    list_collection_languages,
    list_recent_github_ids,
)

COLLECTION_LIMIT = 10
SEARCH_PAGE_SIZE = 10
RETENTION_DAYS = 180


def _week_start(target: datetime) -> date:
    return target.date() - timedelta(days=target.weekday())


def _excluded_languages() -> set[str]:
    return {
        language.strip()
        for language in settings.TRENDING_EXCLUDED_LANGUAGES
        if language.strip()
    }


def _select_candidates(
    candidates: list[TrendingRepositoryCandidate],
    *,
    excluded_github_ids: set[int],
) -> list[TrendingRepositoryCandidate]:
    selected: list[TrendingRepositoryCandidate] = []
    selected_github_ids: set[int] = set()
    for candidate in sorted(
        candidates,
        key=lambda item: (-item.stars, item.full_name, item.github_id),
    ):
        if (
            candidate.github_id in excluded_github_ids
            or candidate.github_id in selected_github_ids
        ):
            continue
        selected.append(candidate)
        selected_github_ids.add(candidate.github_id)
        if len(selected) == COLLECTION_LIMIT:
            break
    return selected


def _collect_candidates(
    *,
    languages: list[str],
    created_after: str,
    excluded_github_ids: set[int],
) -> list[TrendingRepositoryCandidate]:
    candidates: list[TrendingRepositoryCandidate] = []
    pages = dict.fromkeys(languages, 1)
    has_next = dict.fromkeys(languages, True)
    while any(has_next.values()):
        for language in languages:
            if not has_next[language]:
                continue
            result = search_trending_repositories(
                language=language,
                created_after=created_after,
                page=pages[language],
                per_page=SEARCH_PAGE_SIZE,
            )
            candidates.extend(result.repositories)
            has_next[language] = result.has_next
            pages[language] += 1
        selected = _select_candidates(
            candidates,
            excluded_github_ids=excluded_github_ids,
        )
        if len(selected) == COLLECTION_LIMIT:
            return selected
    return _select_candidates(
        candidates,
        excluded_github_ids=excluded_github_ids,
    )


def collect_trending_repositories(*, collected_at: datetime) -> int:
    """이번 주 트렌딩 Repository를 수집하고 정상 결과만 저장한다.

    GitHub 호출은 트랜잭션 밖에서 모두 완료하며, 일부 호출이 실패하면
    기존 정상 결과를 변경하지 않는다.

    Returns:
        새로 저장한 Repository 수. 이미 이번 주 수집이 끝났으면 0.
    """
    week_start = _week_start(collected_at)
    if has_successful_selection(week_start):
        return 0
    selected_after = collected_at - timedelta(days=RETENTION_DAYS)
    recent_github_ids = list_recent_github_ids(selected_after)
    languages = list_collection_languages(
        excluded_languages=_excluded_languages()
    )
    candidates = _collect_candidates(
        languages=languages,
        created_after=selected_after.date().isoformat(),
        excluded_github_ids=recent_github_ids,
    )

    with transaction.atomic():
        selection, created = (
            TrendingRepositorySelection.objects.get_or_create(
                week_start=week_start
            )
        )
        if not created:
            return 0
        TrendingRepositorySelection.objects.filter(
            created_at__lt=selected_after
        ).exclude(pk=selection.pk).delete()
        TrendingRepository.objects.bulk_create(
            [
                TrendingRepository(
                    selection=selection,
                    github_id=candidate.github_id,
                    full_name=candidate.full_name,
                    html_url=candidate.html_url,
                    description=candidate.description,
                    language=candidate.language,
                    stars=candidate.stars,
                    forks=candidate.forks,
                    position=position,
                )
                for position, candidate in enumerate(candidates, start=1)
            ]
        )
    return len(candidates)
