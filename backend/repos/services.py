"""repos 비즈니스 로직.

- parse_github_url(): URL → (owner, repo)
- link_repository(): URL 받아서 캐시 우선 조회, 미스면 GitHub API 호출 후 저장
- refresh_repository(): GitHub API 재호출 후 갱신. 실패 시 기존 캐시는 유지.
- compute_team_rankings(): cached repo를 owner로 그룹핑 후 점수 계산
"""

import re
from datetime import datetime, timedelta, timezone
from typing import Iterable

from django.utils.dateparse import parse_datetime

from . import github_client
from .exceptions import GitHubError, InvalidGithubUrl
from .models import Repository


GITHUB_URL_RE = re.compile(
    r"^https?://github\.com/"
    r"(?P<owner>[A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))/"
    r"(?P<repo>[A-Za-z0-9._-]+?)"
    r"(?:\.git)?/?$"
)


def parse_github_url(url: str) -> tuple[str, str]:
    if not url or not isinstance(url, str):
        raise InvalidGithubUrl()
    cleaned = url.strip()
    m = GITHUB_URL_RE.match(cleaned)
    if not m:
        raise InvalidGithubUrl()
    return m.group("owner"), m.group("repo")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _map_to_kwargs(data: dict) -> dict:
    return {
        "github_id": data.get("id"),
        "owner": (data.get("owner") or {}).get("login") or "",
        "repo": data.get("name") or "",
        "full_name": data.get("full_name") or "",
        "name": data.get("name") or "",
        "description": data.get("description"),
        "language": data.get("language"),
        "stars": int(data.get("stargazers_count") or 0),
        "forks": int(data.get("forks_count") or 0),
        "topics": list(data.get("topics") or []),
        "html_url": data.get("html_url") or "",
        "github_updated_at": parse_datetime(data.get("updated_at") or "") or None,
        "fetched_at": _now(),
    }


def link_repository(url: str) -> Repository:
    """URL → 캐시 우선 조회, 없으면 GitHub API 호출 후 생성."""
    owner, repo = parse_github_url(url)
    existing = Repository.objects.filter(owner=owner, repo=repo).first()
    if existing:
        return existing
    data = github_client.fetch_repo(owner, repo)
    kwargs = _map_to_kwargs(data)
    # github_id 충돌 가능성에 대비해 update_or_create 사용
    obj, _ = Repository.objects.update_or_create(
        owner=kwargs["owner"], repo=kwargs["repo"], defaults=kwargs
    )
    return obj


def lookup_repository(url: str) -> Repository | None:
    """캐시본만 조회 (GitHub API 호출하지 않음)."""
    owner, repo = parse_github_url(url)
    return Repository.objects.filter(owner=owner, repo=repo).first()


def refresh_repository(repository: Repository) -> Repository:
    """GitHub API 재호출 후 갱신. 실패 시 예외 발생, 기존 데이터는 보존됨."""
    data = github_client.fetch_repo(repository.owner, repository.repo)
    repository.stars = int(data.get("stargazers_count") or 0)
    repository.forks = int(data.get("forks_count") or 0)
    repository.language = data.get("language")
    repository.topics = list(data.get("topics") or [])
    parsed = parse_datetime(data.get("updated_at") or "") or None
    if parsed:
        repository.github_updated_at = parsed
    repository.fetched_at = _now()
    repository.description = data.get("description")
    repository.full_name = data.get("full_name") or repository.full_name
    repository.html_url = data.get("html_url") or repository.html_url
    repository.save()
    return repository


def _recent_score(repos: Iterable[Repository]) -> int:
    """가장 최근 업데이트 기준: <=30일 → 20, <=90일 → 10, 그 외 0."""
    now = _now()
    most_recent: datetime | None = None
    for r in repos:
        if r.github_updated_at and (most_recent is None or r.github_updated_at > most_recent):
            most_recent = r.github_updated_at
    if not most_recent:
        return 0
    diff = now - most_recent
    if diff <= timedelta(days=30):
        return 20
    if diff <= timedelta(days=90):
        return 10
    return 0


def compute_team_rankings() -> list[dict]:
    """cached repo를 owner로 그룹핑 후 점수 계산."""
    all_repos = list(Repository.objects.all())
    groups: dict[str, list[Repository]] = {}
    for r in all_repos:
        groups.setdefault(r.owner, []).append(r)

    rows: list[dict] = []
    calculated_at = _now().isoformat()
    for owner, repos in groups.items():
        project_count = len(repos)
        total_stars = sum(r.stars or 0 for r in repos)
        total_forks = sum(r.forks or 0 for r in repos)
        recent = _recent_score(repos)
        score = (project_count * 30) + (total_stars * 2) + (total_forks * 3) + recent
        rows.append(
            {
                "team": owner,
                "score": score,
                "projectCount": project_count,
                "totalStars": total_stars,
                "totalForks": total_forks,
                "recentUpdateScore": recent,
                "repositories": [
                    {
                        "id": r.id,
                        "name": r.name,
                        "fullName": r.full_name,
                        "stars": r.stars,
                        "forks": r.forks,
                        "language": r.language,
                        "htmlUrl": r.html_url,
                        "githubUpdatedAt": (
                            r.github_updated_at.isoformat()
                            if r.github_updated_at
                            else None
                        ),
                    }
                    for r in repos
                ],
                "calculatedAt": calculated_at,
            }
        )
    rows.sort(key=lambda r: r["score"], reverse=True)
    for idx, row in enumerate(rows, start=1):
        row["rank"] = idx
    return rows


def refresh_all_repositories() -> dict:
    """모든 캐시 repo를 GitHub에서 재조회. 실패는 카운트하고 계속 진행한다."""
    succeeded = 0
    failed: list[dict] = []
    for r in Repository.objects.all():
        try:
            refresh_repository(r)
            succeeded += 1
        except GitHubError as e:
            failed.append({"id": r.id, "fullName": r.full_name, "code": e.code, "message": e.message})
    return {"succeeded": succeeded, "failed": failed}
