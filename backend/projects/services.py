from collections.abc import Sequence
from dataclasses import dataclass

from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import PermissionDenied
from django.db import IntegrityError, transaction
from django.db.models import Q

from users.models import User

from .github_client import (
    GitHubClientError,
    GitHubErrorCode,
    GitHubRepositoryIdentity,
    fetch_repository_identity,
    parse_repository_url,
)
from .models import Member, Project, ProjectLanguage, Repository
from .tasks import enqueue_repository_refresh

REPOSITORY_ALREADY_LINKED_MESSAGE = (
    "이미 다른 프로젝트에 연결된 Repository입니다."
)
REPOSITORY_CHANGE_NOT_ALLOWED_MESSAGE = (
    "이미 등록된 Repository는 변경하거나 연결 해제할 수 없습니다."
)
REPOSITORY_INVALID_MESSAGE = (
    "존재하는 공개 GitHub Repository URL을 입력해주세요."
)
REPOSITORY_LOOKUP_FAILED_MESSAGE = (
    "GitHub Repository 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요."
)
REPOSITORY_SAVE_FAILED_MESSAGE = (
    "Repository를 등록하지 못했습니다. 잠시 후 다시 시도해주세요."
)


class RepositoryRegistrationError(ValueError):
    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


class ProjectCreationError(ValueError):
    """프로젝트 생성 중 예상 가능한 입력 충돌을 나타낸다."""


@dataclass(frozen=True)
class ProjectCreationResult:
    """프로젝트 생성 결과와 비치명적 Repository 등록 오류를 나타낸다.

    Attributes:
        project: 생성된 프로젝트.
        leader_member: 생성된 팀장 멤버십.
        repository_error: Repository 등록 실패 오류. 성공하면 None.
    """

    project: Project
    leader_member: Member
    repository_error: RepositoryRegistrationError | None


def _registration_error(
    error: GitHubClientError,
) -> RepositoryRegistrationError:
    code, message = {
        GitHubErrorCode.INVALID_URL: (
            "INVALID_GITHUB_URL",
            REPOSITORY_INVALID_MESSAGE,
        ),
        GitHubErrorCode.REPOSITORY_NOT_FOUND: (
            "GITHUB_REPOSITORY_NOT_FOUND",
            REPOSITORY_INVALID_MESSAGE,
        ),
        GitHubErrorCode.PRIVATE_REPOSITORY: (
            "PRIVATE_REPOSITORY",
            REPOSITORY_INVALID_MESSAGE,
        ),
        GitHubErrorCode.RATE_LIMIT_EXCEEDED: (
            "GITHUB_RATE_LIMIT_EXCEEDED",
            REPOSITORY_LOOKUP_FAILED_MESSAGE,
        ),
        GitHubErrorCode.API_FAILED: (
            "GITHUB_API_FAILED",
            REPOSITORY_LOOKUP_FAILED_MESSAGE,
        ),
    }[error.code]
    return RepositoryRegistrationError(code, message)


def prepare_repository_registration(
    repository_url: str,
) -> GitHubRepositoryIdentity:
    try:
        full_name = parse_repository_url(repository_url)
    except GitHubClientError as error:
        raise _registration_error(error) from error
    if Repository.objects.filter(full_name__iexact=full_name).exists():
        raise RepositoryRegistrationError(
            "INVALID_PROJECT_INPUT",
            REPOSITORY_ALREADY_LINKED_MESSAGE,
        )

    try:
        data = fetch_repository_identity(full_name)
    except GitHubClientError as error:
        raise _registration_error(error) from error
    return data


def _assert_linked_repository_immutable(
    repository_url: str | None,
) -> None:
    """이미 연결된 Repository는 연결 해제만 거절하고 URL은 무시한다.

    FE는 상세 조회의 htmlUrl을 그대로 다시 보낸다. refresh로 html_url이
    바뀌어도 finish/수정이 실패하지 않도록, 비어 있지 않은 URL은 비교하지
    않는다. 연결 자체는 update 경로에서 절대 바꾸지 않는다.
    """
    if not repository_url:
        raise ValueError(REPOSITORY_CHANGE_NOT_ALLOWED_MESSAGE)


def prepare_project_repository_update(
    project: Project,
    repository_url: str | None,
) -> GitHubRepositoryIdentity | None:
    repository = getattr(project, "repository", None)
    if repository is not None:
        _assert_linked_repository_immutable(repository_url)
        return None
    if not repository_url:
        return None
    return prepare_repository_registration(repository_url)


def update_project_repository(
    project: Project,
    repository_url: str | None,
    *,
    previous_project_status: str | None = None,
    repository_data: GitHubRepositoryIdentity | None = None,
) -> None:
    repository = getattr(project, "repository", None)
    if repository:
        _assert_linked_repository_immutable(repository_url)
        if (
            previous_project_status == project.Status.INACTIVE
            and project.status == project.Status.ACTIVE
        ):
            transaction.on_commit(
                lambda: enqueue_repository_refresh(repository.pk),
                robust=True,
            )
        return
    if not repository_url:
        return

    data = repository_data or prepare_repository_registration(repository_url)
    if Repository.objects.filter(
        Q(full_name__iexact=data.full_name)
        | Q(github_id=data.github_id)
    ).exists():
        raise RepositoryRegistrationError(
            "INVALID_PROJECT_INPUT",
            REPOSITORY_ALREADY_LINKED_MESSAGE,
        )

    try:
        repository = Repository.objects.create(
            project=project,
            github_id=data.github_id,
            name=data.name,
            full_name=data.full_name,
            html_url=data.html_url,
        )
    except IntegrityError as error:
        raise RepositoryRegistrationError(
            "INTERNAL_SERVER_ERROR",
            REPOSITORY_SAVE_FAILED_MESSAGE,
        ) from error
    transaction.on_commit(
        lambda: enqueue_repository_refresh(repository.pk),
        robust=True,
    )


def create_project(
    *,
    actor: User,
    name: str,
    description: str,
    repository_url: str | None,
    demo_url: str | None,
    presentation_url: str | None,
    languages: Sequence[ProjectLanguage],
) -> ProjectCreationResult:
    """프로젝트와 팀장 멤버십을 생성하고 Repository 등록을 시도한다.

    Repository 등록 실패는 프로젝트 생성을 롤백하지 않고 결과에 담아
    반환한다. GitHub 조회는 프로젝트 생성 트랜잭션이 끝난 뒤 수행한다.

    Args:
        actor: 프로젝트를 생성하는 사용자.
        name: 프로젝트명.
        description: 프로젝트 설명.
        repository_url: 연결할 Repository URL.
        demo_url: 결과물 URL.
        presentation_url: 발표 자료 URL.
        languages: 프로젝트에 연결할 사용 언어.

    Returns:
        생성된 프로젝트와 Repository 등록 오류를 담은 결과.

    Raises:
        ProjectCreationError: 이미 등록된 프로젝트명인 경우.
        IntegrityError: 언어 또는 팀장 멤버십 저장에 실패한 경우.
    """
    with transaction.atomic():
        try:
            project = Project.objects.create(
                name=name,
                description=description,
                demo_url=demo_url,
                presentation_url=presentation_url,
            )
        except IntegrityError as error:
            raise ProjectCreationError(
                "이미 등록된 프로젝트명입니다."
            ) from error
        project.languages.set(languages)
        leader_member = Member.objects.create(
            project=project,
            user=actor,
            is_leader=True,
            status=Member.Status.JOINED,
        )

    repository_error: RepositoryRegistrationError | None = None
    try:
        update_project_repository(project, repository_url)
    except RepositoryRegistrationError as error:
        repository_error = error

    return ProjectCreationResult(
        project=project,
        leader_member=leader_member,
        repository_error=repository_error,
    )


def _writable_project_queryset(*, actor_id: int):
    """삭제되지 않은 프로젝트에 팀장 annotation을 붙인 QuerySet."""
    return Project.queryset_with_actor_leadership(
        actor_id=actor_id
    ).exclude(status=Project.Status.DELETED)


def _ensure_actor_is_leader(
    *,
    actor: User | AnonymousUser,
    project: Project,
) -> None:
    """요청자가 프로젝트 팀장인지 확인한다.

    `can_be_edited_by()`는 ACTIVE 수정 UI용이라 FINISHED 삭제나
    INACTIVE→ACTIVE 쓰기 경로에 쓰면 회귀한다. 쓰기 권한은
    `Project.is_leader()`와 같은 조건으로만 판정한다.

    `queryset_with_actor_leadership()`로 조회된 경우 Exists annotation을
    쓰고, 그렇지 않으면 Member를 읽어 `Project.is_leader()`로 확인한다.
    """
    if not actor.is_authenticated:
        raise PermissionDenied
    actor_is_leader = getattr(project, "actor_is_leader", None)
    if actor_is_leader is not None:
        if not actor_is_leader:
            raise PermissionDenied
        return
    member = (
        Member.objects.filter(
            project_id=project.pk,
            user_id=actor.pk,
            status=Member.Status.JOINED,
        )
        .order_by("-is_leader", "-created_at", "-pk")
        .first()
    )
    if not project.is_leader(member):
        raise PermissionDenied


def get_project_update_target(
    *,
    actor: User | AnonymousUser,
    project_id: int,
) -> Project:
    """수정 입력 검증 전에 대상 프로젝트와 팀장 권한을 확인한다.

    Serializer 실행보다 먼저 404·403을 결정하기 위해 사용한다.
    Repository는 이후 사전 검증에 쓸 수 있도록 함께 조회한다.
    팀장 여부는 `Project.is_leader()`와 같은 조건을 Exists로 한 번에 조회한다.

    Args:
        actor: 프로젝트 수정을 요청한 사용자.
        project_id: 수정 대상 프로젝트 ID.

    Returns:
        Repository가 함께 로드된 프로젝트.

    Raises:
        Project.DoesNotExist: 프로젝트가 존재하지 않는 경우.
        PermissionDenied: 요청자가 인증되지 않았거나 팀장이 아닌 경우.
    """
    if not actor.is_authenticated:
        raise PermissionDenied
    project = (
        _writable_project_queryset(actor_id=actor.pk)
        .select_related("repository")
        .get(pk=project_id)
    )
    _ensure_actor_is_leader(actor=actor, project=project)
    return project


def update_project(
    *,
    actor: User | AnonymousUser,
    project: Project,
    name: str,
    description: str,
    repository_url: str | None,
    demo_url: str | None,
    presentation_url: str | None,
    languages: Sequence[ProjectLanguage],
    status: str,
) -> None:
    """프로젝트와 연결 정보를 수정한다.

    호출 전에 `get_project_update_target()`으로 대상과 팀장 권한을
    확인하는 것을 전제로 한다. GitHub 조회는 트랜잭션 밖에서 수행하고,
    DB 잠금 구간에서는 권한 재검증·갱신만 수행한다.

    Args:
        actor: 프로젝트 수정을 요청한 사용자.
        project: 수정 대상 프로젝트. Repository가 함께 로드된 것이 좋다.
        name: 프로젝트명.
        description: 프로젝트 설명.
        repository_url: 연결할 Repository URL.
        demo_url: 결과물 URL.
        presentation_url: 발표 자료 URL.
        languages: 변경할 프로젝트 사용 언어.
        status: 변경할 프로젝트 상태.

    Raises:
        Project.DoesNotExist: 잠금 재조회 시 프로젝트가 사라진 경우.
        PermissionDenied: 요청자가 프로젝트 팀장이 아닌 경우.
        ProjectCreationError: 프로젝트명 unique 충돌이 난 경우.
        RepositoryRegistrationError: Repository 등록에 실패한 경우.
        ValueError: 상태 전이 또는 Repository 연결 해제가 허용되지 않는 경우.
    """
    if not actor.is_authenticated:
        raise PermissionDenied

    # GitHub 조회 전에 상태 전이를 먼저 막아 불필요한 외부 호출을 줄인다.
    project.assert_can_transition_to(status)

    repository_data = prepare_project_repository_update(
        project,
        repository_url,
    )

    with transaction.atomic():
        locked_project = (
            _writable_project_queryset(actor_id=actor.pk)
            .select_related("repository")
            .select_for_update()
            .get(pk=project.pk)
        )
        _ensure_actor_is_leader(actor=actor, project=locked_project)
        locked_project.assert_can_transition_to(status)

        previous_project_status = locked_project.status
        locked_project.name = name
        locked_project.description = description
        locked_project.demo_url = demo_url
        locked_project.presentation_url = presentation_url
        locked_project.set_status(status)
        try:
            locked_project.save()
        except IntegrityError as error:
            # 생성 경로와 같이 이름 unique 충돌은 입력 오류로 취급한다.
            raise ProjectCreationError(
                "이미 등록된 프로젝트명입니다."
            ) from error
        locked_project.languages.set(languages)
        update_project_repository(
            locked_project,
            repository_url,
            previous_project_status=previous_project_status,
            repository_data=repository_data,
        )


def mark_project_deleted(
    *,
    actor: User | AnonymousUser,
    project_id: int,
) -> None:
    """프로젝트를 잠근 뒤 삭제 상태로 전환한다.

    Args:
        actor: 프로젝트 삭제를 요청한 사용자.
        project_id: 삭제 상태로 전환할 프로젝트 ID.

    Raises:
        Project.DoesNotExist: 프로젝트가 존재하지 않는 경우.
        PermissionDenied: 요청자가 프로젝트 팀장이 아닌 경우.
        ValueError: 현재 상태에서 삭제 상태로 전환할 수 없는 경우.
    """
    if not actor.is_authenticated:
        raise PermissionDenied

    with transaction.atomic():
        project = (
            _writable_project_queryset(actor_id=actor.pk)
            .select_for_update()
            .get(pk=project_id)
        )
        _ensure_actor_is_leader(actor=actor, project=project)
        project.set_status(Project.Status.DELETED)
        project.save(update_fields=("status", "updated_at"))
