from django.urls import path

from .views import RepositoryLink, RepositoryLookup, RepositoryRefresh


urlpatterns = [
    path("link", RepositoryLink.as_view()),
    path("", RepositoryLookup.as_view()),
    path("<int:pk>/refresh", RepositoryRefresh.as_view()),
]
