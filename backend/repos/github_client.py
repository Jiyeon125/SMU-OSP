"""GitHub REST API 클라이언트.

- 토큰이 설정되어 있으면 Authorization 헤더 첨부 (rate limit 완화)
- 응답 코드별로 도메인 예외로 변환
"""

import requests
from django.conf import settings

from .exceptions import (
    GitHubError,
    GithubRateLimitExceeded,
    GithubRepositoryNotFound,
    PrivateRepositoryNotSupported,
)


def _base_url() -> str:
    return getattr(settings, "GITHUB_API_BASE_URL", "https://api.github.com")


def _token() -> str:
    token = getattr(settings, "GITHUB_TOKEN", "") or getattr(settings, "GH_PAT", "")
    if not token or token.startswith("dummy"):
        return ""
    return token


def _headers() -> dict[str, str]:
    h = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = _token()
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def fetch_repo(owner: str, repo: str) -> dict:
    """GET /repos/{owner}/{repo}."""
    url = f"{_base_url()}/repos/{owner}/{repo}"
    try:
        response = requests.get(url, headers=_headers(), timeout=10)
    except requests.RequestException as e:
        raise GitHubError(f"GitHub API 네트워크 오류: {e}") from e

    if response.status_code == 404:
        # GitHub는 인증 없이 private repo에 접근하면 404를 반환한다.
        # 토큰이 있어도 권한이 없으면 404일 수 있어, 404는 일관적으로 NOT_FOUND로 처리한다.
        raise GithubRepositoryNotFound()
    if response.status_code == 403:
        body = response.text.lower()
        if "rate limit" in body or "api rate limit" in body:
            raise GithubRateLimitExceeded()
        raise GitHubError("GitHub API 접근이 거부되었습니다.")
    if response.status_code >= 400:
        raise GitHubError(
            f"GitHub API 호출에 실패했습니다. (HTTP {response.status_code})"
        )

    data = response.json()
    if not isinstance(data, dict):
        raise GitHubError("GitHub 응답 형식이 올바르지 않습니다.")
    if data.get("private") is True:
        raise PrivateRepositoryNotSupported()
    return data
