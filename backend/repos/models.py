from django.db import models

from common.models import CommonModel


class Repository(CommonModel):
    """GitHub repository metadata 캐시 (public repo 한정)."""

    github_id = models.BigIntegerField(unique=True)
    owner = models.CharField(max_length=120)
    repo = models.CharField(max_length=120)
    full_name = models.CharField(max_length=255)
    name = models.CharField(max_length=120)
    description = models.TextField(null=True, blank=True)
    language = models.CharField(max_length=60, null=True, blank=True)
    stars = models.IntegerField(default=0)
    forks = models.IntegerField(default=0)
    topics = models.JSONField(default=list, blank=True)
    html_url = models.URLField(max_length=500)
    github_updated_at = models.DateTimeField(null=True, blank=True)
    fetched_at = models.DateTimeField()

    class Meta:
        unique_together = ("owner", "repo")
        verbose_name_plural = "Repositories"

    def __str__(self) -> str:
        return self.full_name
