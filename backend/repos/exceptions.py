"""도메인 예외 → 응답 코드/HTTP 상태 매핑."""


class GitHubError(Exception):
    code = "GITHUB_API_FAILED"
    message = "GitHub API 호출에 실패했습니다."
    http_status = 500

    def __init__(self, message: str | None = None):
        if message:
            self.message = message
        super().__init__(self.message)


class InvalidGithubUrl(GitHubError):
    code = "INVALID_GITHUB_URL"
    message = "유효하지 않은 GitHub Repository URL입니다."
    http_status = 400


class GithubRepositoryNotFound(GitHubError):
    code = "GITHUB_REPOSITORY_NOT_FOUND"
    message = "존재하지 않는 GitHub Repository입니다."
    http_status = 404


class PrivateRepositoryNotSupported(GitHubError):
    code = "PRIVATE_REPOSITORY_NOT_SUPPORTED"
    message = "Private repository는 지원하지 않습니다."
    http_status = 403


class GithubRateLimitExceeded(GitHubError):
    code = "GITHUB_RATE_LIMIT_EXCEEDED"
    message = "GitHub API rate limit을 초과했습니다. 잠시 후 다시 시도해주세요."
    http_status = 429
