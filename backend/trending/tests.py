from datetime import datetime, timedelta
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.test import TestCase, override_settings

from projects.models import Project, Repository, RepositoryLanguage

from .github_client import (
    GitHubSearchError,
    TrendingRepositoryCandidate,
    TrendingRepositorySearchPage,
)
from .models import TrendingRepository, TrendingRepositorySelection
from .selectors import INITIAL_LANGUAGES, list_collection_languages
from .services import collect_trending_repositories


def _candidate(
    github_id: int,
    *,
    language: str = "Python",
    stars: int | None = None,
) -> TrendingRepositoryCandidate:
    return TrendingRepositoryCandidate(
        github_id=github_id,
        full_name=f"owner/repository-{github_id}",
        html_url=f"https://github.com/owner/repository-{github_id}",
        description=f"Repository {github_id}",
        language=language,
        stars=stars if stars is not None else 2000 - github_id,
        forks=github_id,
    )


@override_settings(TRENDING_EXCLUDED_LANGUAGES=[])
class TrendingServiceTests(TestCase):
    def setUp(self):
        self.collected_at = datetime(
            2026,
            8,
            17,
            tzinfo=ZoneInfo("Asia/Seoul"),
        )

    def test_initial_languages_are_used_before_five_languages_exist(self):
        self.assertEqual(
            list_collection_languages(excluded_languages=set()),
            list(INITIAL_LANGUAGES),
        )

    def test_repository_languages_are_ranked_by_total_bytes(self):
        project = Project.objects.create(name="Project", description="Test")
        repository = Repository.objects.create(
            project=project,
            github_id=1,
            name="repository",
            full_name="owner/repository",
            html_url="https://github.com/owner/repository",
        )
        for index, language in enumerate(
            ("Python", "Java", "Go", "Rust", "Ruby", "PHP"),
            start=1,
        ):
            RepositoryLanguage.objects.create(
                repository=repository,
                language=language,
                bytes=index * 100,
            )

        languages = list_collection_languages(
            excluded_languages={"php"},
        )

        self.assertEqual(languages, ["Ruby", "Rust", "Go", "Java", "Python"])

    @patch("trending.services.list_collection_languages")
    @patch("trending.services.search_trending_repositories")
    def test_collection_saves_one_week_only_once(
        self,
        search_repositories,
        list_languages,
    ):
        list_languages.return_value = ["Python", "JavaScript"]
        search_repositories.side_effect = [
            TrendingRepositorySearchPage(
                repositories=tuple(_candidate(index) for index in range(1, 6)),
                has_next=False,
            ),
            TrendingRepositorySearchPage(
                repositories=tuple(
                    _candidate(index, language="JavaScript")
                    for index in range(6, 11)
                ),
                has_next=False,
            ),
        ]

        first_count = collect_trending_repositories(
            collected_at=self.collected_at
        )
        second_count = collect_trending_repositories(
            collected_at=self.collected_at + timedelta(days=1)
        )

        self.assertEqual(first_count, 10)
        self.assertEqual(second_count, 0)
        self.assertEqual(TrendingRepository.objects.count(), 10)
        self.assertEqual(TrendingRepositorySelection.objects.count(), 1)
        self.assertEqual(search_repositories.call_count, 2)

    @patch("trending.services.list_collection_languages")
    @patch("trending.services.search_trending_repositories")
    def test_collection_orders_candidates_by_stars_across_languages(
        self,
        search_repositories,
        list_languages,
    ):
        list_languages.return_value = ["Python", "JavaScript"]
        search_repositories.side_effect = [
            TrendingRepositorySearchPage(
                repositories=(
                    _candidate(1, stars=1500),
                    _candidate(2, stars=3000),
                ),
                has_next=False,
            ),
            TrendingRepositorySearchPage(
                repositories=(
                    _candidate(3, language="JavaScript", stars=2500),
                ),
                has_next=False,
            ),
        ]

        collect_trending_repositories(collected_at=self.collected_at)

        self.assertEqual(
            list(
                TrendingRepository.objects.values_list(
                    "github_id",
                    "position",
                )
            ),
            [(2, 1), (3, 2), (1, 3)],
        )

    @patch("trending.services.list_collection_languages")
    @patch("trending.services.search_trending_repositories")
    def test_partial_github_failure_keeps_previous_results(
        self,
        search_repositories,
        list_languages,
    ):
        previous_selection = TrendingRepositorySelection.objects.create(
            week_start=self.collected_at.date() - timedelta(days=7)
        )
        TrendingRepository.objects.create(
            selection=previous_selection,
            github_id=100,
            full_name="owner/previous",
            html_url="https://github.com/owner/previous",
            description="Previous result",
            language="Python",
            stars=3000,
            forks=10,
            position=1,
        )
        list_languages.return_value = ["Python", "JavaScript"]
        search_repositories.side_effect = [
            TrendingRepositorySearchPage(
                repositories=(_candidate(1),),
                has_next=False,
            ),
            GitHubSearchError("failed"),
        ]

        with self.assertRaises(GitHubSearchError):
            collect_trending_repositories(collected_at=self.collected_at)

        self.assertEqual(TrendingRepositorySelection.objects.count(), 1)
        self.assertEqual(
            list(
                TrendingRepository.objects.values_list(
                    "github_id",
                    flat=True,
                )
            ),
            [100],
        )


class TrendingApiTests(TestCase):
    def test_latest_ten_repositories_are_returned_in_selection_order(self):
        selection = TrendingRepositorySelection.objects.create(
            week_start=datetime(2026, 8, 17).date()
        )
        TrendingRepository.objects.bulk_create(
            [
                TrendingRepository(
                    selection=selection,
                    github_id=index,
                    full_name=f"owner/repository-{index}",
                    html_url=f"https://github.com/owner/repository-{index}",
                    description=None,
                    language="Python",
                    stars=2000 - index,
                    forks=index,
                    position=index,
                )
                for index in range(1, 12)
            ]
        )

        response = self.client.get("/api/v1/trending/repositories")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["status"], "SUCCESS")
        self.assertEqual(len(body["data"]), 10)
        self.assertEqual(body["data"][0]["githubId"], 1)
        self.assertEqual(body["data"][-1]["githubId"], 10)

    def test_only_repositories_from_latest_selection_are_returned(self):
        previous_selection = TrendingRepositorySelection.objects.create(
            week_start=datetime(2026, 8, 10).date()
        )
        latest_selection = TrendingRepositorySelection.objects.create(
            week_start=datetime(2026, 8, 17).date()
        )
        TrendingRepository.objects.create(
            selection=previous_selection,
            github_id=1,
            full_name="owner/previous",
            html_url="https://github.com/owner/previous",
            description=None,
            language="Python",
            stars=3000,
            forks=100,
            position=1,
        )
        TrendingRepository.objects.create(
            selection=latest_selection,
            github_id=2,
            full_name="owner/latest",
            html_url="https://github.com/owner/latest",
            description=None,
            language="Python",
            stars=2000,
            forks=50,
            position=1,
        )

        response = self.client.get("/api/v1/trending/repositories")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [item["githubId"] for item in response.json()["data"]],
            [2],
        )
