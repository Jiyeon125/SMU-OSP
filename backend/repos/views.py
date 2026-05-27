"""repos 엔드포인트.

POST /api/v1/repositories/link           body: {url}
GET  /api/v1/repositories/?url=...       (cache-only lookup)
POST /api/v1/repositories/<id>/refresh

GET  /api/v1/rankings/teams
POST /api/v1/rankings/teams/recalculate
"""

from rest_framework.views import APIView

from . import services
from .exceptions import GitHubError, GithubRepositoryNotFound
from .models import Repository
from .response import fail, success
from .serializers import RepositorySerializer


class RepositoryLink(APIView):
    """URL → 캐시 우선 조회, 없으면 GitHub API 호출 후 저장."""

    def post(self, request):
        url = (request.data or {}).get("url")
        try:
            repo = services.link_repository(url or "")
            return success(RepositorySerializer(repo).data)
        except GitHubError as e:
            return fail(e.code, e.message, http=e.http_status)


class RepositoryLookup(APIView):
    """캐시본만 조회. GitHub API 호출하지 않음."""

    def get(self, request):
        url = request.query_params.get("url")
        try:
            repo = services.lookup_repository(url or "")
            if not repo:
                raise GithubRepositoryNotFound(
                    "해당 URL의 캐시된 Repository가 없습니다. /link로 먼저 등록해주세요."
                )
            return success(RepositorySerializer(repo).data)
        except GitHubError as e:
            return fail(e.code, e.message, http=e.http_status)


class RepositoryRefresh(APIView):
    """수동 갱신. 실패 시 기존 캐시는 유지하고 사용자에게는 실패 메시지만 반환."""

    def post(self, request, pk: int):
        repo = Repository.objects.filter(pk=pk).first()
        if not repo:
            return fail(
                "GITHUB_REPOSITORY_NOT_FOUND",
                "해당 Repository 캐시를 찾을 수 없습니다.",
                http=404,
            )
        try:
            services.refresh_repository(repo)
            return success(RepositorySerializer(repo).data)
        except GitHubError as e:
            # 캐시 보존: 모델은 위에서 save 전 단계로 롤백되지는 않지만,
            # services.refresh_repository는 GitHub 호출 실패 시 save()를 호출하지 않으므로
            # 기존 데이터가 그대로 유지된다.
            return fail(e.code, e.message, http=e.http_status)


class RankingsTeamsList(APIView):
    """현재 캐시 기준 팀 랭킹 (정적 계산)."""

    def get(self, request):
        rows = services.compute_team_rankings()
        return success({"rankings": rows})


class RankingsTeamsRecalculate(APIView):
    """모든 cached repo refresh → 랭킹 재계산. 부분 실패도 허용."""

    def post(self, request):
        refresh_result = services.refresh_all_repositories()
        rows = services.compute_team_rankings()
        return success(
            {
                "rankings": rows,
                "refresh": refresh_result,
            }
        )
