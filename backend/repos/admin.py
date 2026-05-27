from django.contrib import admin

from .models import Repository


@admin.register(Repository)
class RepositoryAdmin(admin.ModelAdmin):
    list_display = (
        "full_name",
        "language",
        "stars",
        "forks",
        "github_updated_at",
        "fetched_at",
    )
    search_fields = ("full_name", "owner", "repo")
    ordering = ("-stars",)
