import logging
from datetime import UTC, datetime, timedelta

import requests
from celery import shared_task
from django.conf import settings

from users.models import User, UserActivity
from users.services import refresh_user_ranking_caches

GITHUB_API_URL = "https://api.github.com/graphql"

HEADERS = {
    "Authorization": f"Bearer {settings.GH_PAT}",
    "Content-Type": "application/json",
}
logger = logging.getLogger(__name__)


@shared_task
def daily_update():
    users = User.objects.all().filter(is_superuser=False)

    for user in users:
        print(f"Start User {user.username} updated")

        try:
            data = get_initial_info(user.username)
            if data is None:
                logger.error(
                    "GitHub activity collection failed for user %s",
                    user.username,
                )
                continue
            stars = sum(
                repo["stargazerCount"]
                for repo in data["data"]["user"]["repositories"]["nodes"]
            )
        except (requests.RequestException, KeyError, TypeError, ValueError):
            logger.exception(
                "GitHub activity collection failed for user %s",
                user.username,
            )
            continue

        print(data)
        period_end = (datetime.now(UTC) - timedelta(days=1)).date()
        save_yesterday_contributions(
            user,
            stars,
            activity_date=period_end,
        )
        refresh_user_ranking_caches(
            user_id=user.pk,
            period_end=period_end,
        )
        print(f"User {user.username} updated")

    print("All users updated")


@shared_task
def initial_process(username):

    print("Start initial process")

    user = User.objects.get(username=username)

    data = get_initial_info(username)

    print(data)

    github_account_created_at = data["data"]["user"]["createdAt"]

    repositories = data["data"]["user"]["repositories"]["nodes"]
    stars = sum(repo["stargazerCount"] for repo in repositories)

    print(f"User GitHub account created at: {github_account_created_at}")
    print(f"Total stars: {stars}")

    save_previous_contributions(user, github_account_created_at)

    period_end = (datetime.now(UTC) - timedelta(days=1)).date()
    UserActivity.objects.update_or_create(
        user=user,
        activity_date=period_end,
        defaults={"stars": stars},
    )
    refresh_user_ranking_caches(
        user_id=user.pk,
        period_end=period_end,
    )


def get_initial_info(username):

    query = f"""
    {{
        user(login: "{username}") {{
            createdAt
            repositories(affiliations: OWNER, privacy: PUBLIC, first: 10) {{
                nodes {{
                    name
                    stargazerCount
                }}
            }}
        }}
    }}
    """
    json_data = {"query": query}

    response = requests.post(GITHUB_API_URL, json=json_data, headers=HEADERS)
    response_data = response.json()

    if "errors" in response_data:
        print(f"GitHub GraphQL API Failed: {response_data['errors']}")
    else:
        return response_data


def save_previous_contributions(user, created_at):
    try:
        print("Start gathering previous contribution data")

        created_at_date = datetime.strptime(created_at, "%Y-%m-%dT%H:%M:%SZ").date()

        yesterday = (datetime.now(UTC) - timedelta(days=1)).date()

        current_date = yesterday

        requests_number = 1

        print(f"yesterday: {yesterday}, created date: {created_at_date}")

        while current_date >= created_at_date:

            from_date = datetime.combine(current_date, datetime.min.time()).strftime(
                "%Y-%m-%dT%H:%M:%SZ"
            )
            to_date = datetime.combine(current_date, datetime.max.time()).strftime(
                "%Y-%m-%dT%H:%M:%SZ"
            )

            print(f"from: {from_date} to: {to_date}, request start")

            query = f"""
            {{
                user(login: "{user.username}") {{
                    contributionsCollection(from: "{from_date}", to: "{to_date}") {{
                        totalCommitContributions
                        pullRequestContributions {{
                            totalCount
                        }}
                        issueContributionsByRepository {{
                            contributions {{
                                totalCount
                            }}
                        }}
                    }}
                }}
            }}
            """

            json_data = {"query": query}

            response = requests.post(GITHUB_API_URL, json=json_data, headers=HEADERS)
            response_data = response.json()

            if "errors" in response_data:
                print(f"GitHub GraphQL API Failed: {response_data['errors']}")
            else:
                print(response_data)
                commits, prs, issues = calculate_contributions(response_data)
                print(f"Commits: {commits}, PRs: {prs}, Issues: {issues}")

            print(f"from: {from_date} to: {to_date}, request {requests_number} times")

            print("Saving data start")
            user_activity = UserActivity.objects.create(user=user)
            user_activity.activity_date = current_date
            user_activity.commits = commits
            user_activity.prs = prs
            user_activity.issues = issues
            user_activity.save()
            print("Done")

            requests_number += 1
            current_date -= timedelta(days=1)

            if requests_number > 100:
                break

        print(f"yesterday: {yesterday}, created date: {created_at_date}")

    except Exception as e:
        print(f"An error occurred: {e}")


def save_yesterday_contributions(
    user,
    stars,
    *,
    activity_date=None,
):
    try:
        print("Start gathering yesterday contribution data")

        yesterday = activity_date or (
            datetime.now(UTC) - timedelta(days=1)
        ).date()

        current_date = yesterday

        print(f"yesterday: {yesterday}")

        from_date = datetime.combine(current_date, datetime.min.time()).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )
        to_date = datetime.combine(current_date, datetime.max.time()).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )

        print(f"from: {from_date} to: {to_date}, request start")

        query = f"""
        {{
            user(login: "{user.username}") {{
                contributionsCollection(from: "{from_date}", to: "{to_date}") {{
                    totalCommitContributions
                    pullRequestContributions {{
                        totalCount
                    }}
                    issueContributionsByRepository {{
                        contributions {{
                            totalCount
                        }}
                    }}
                }}
            }}
        }}
        """

        json_data = {"query": query}

        response = requests.post(GITHUB_API_URL, json=json_data, headers=HEADERS)
        response_data = response.json()

        if "errors" in response_data:
            print(f"GitHub GraphQL API Failed: {response_data['errors']}")
        else:
            print(response_data)
            commits, prs, issues = calculate_contributions(response_data)
            print(f"Commits: {commits}, PRs: {prs}, Issues: {issues}")

        print("Saving data start")
        UserActivity.objects.update_or_create(
            user=user,
            activity_date=current_date,
            defaults={
                "stars": stars,
                "commits": commits,
                "prs": prs,
                "issues": issues,
            },
        )
        print(f"{yesterday} contribution saved")

    except Exception as e:
        print(f"An error occurred: {e}")


def calculate_contributions(response):

    commits = response["data"]["user"]["contributionsCollection"][
        "totalCommitContributions"
    ]
    prs = response["data"]["user"]["contributionsCollection"][
        "pullRequestContributions"
    ]["totalCount"]
    issues = sum(
        repo["contributions"]["totalCount"]
        for repo in response["data"]["user"]["contributionsCollection"][
            "issueContributionsByRepository"
        ]
    )

    return commits, prs, issues
