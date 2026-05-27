from rest_framework import serializers

from .models import Repository


class RepositorySerializer(serializers.ModelSerializer):
    githubId = serializers.IntegerField(source="github_id", read_only=True)
    fullName = serializers.CharField(source="full_name", read_only=True)
    htmlUrl = serializers.CharField(source="html_url", read_only=True)
    githubUpdatedAt = serializers.DateTimeField(
        source="github_updated_at", read_only=True
    )
    fetchedAt = serializers.DateTimeField(source="fetched_at", read_only=True)

    class Meta:
        model = Repository
        fields = (
            "id",
            "githubId",
            "owner",
            "repo",
            "name",
            "fullName",
            "description",
            "language",
            "stars",
            "forks",
            "topics",
            "htmlUrl",
            "githubUpdatedAt",
            "fetchedAt",
        )
