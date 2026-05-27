from django.urls import path

from .views import RankingsTeamsList, RankingsTeamsRecalculate


urlpatterns = [
    path("teams", RankingsTeamsList.as_view()),
    path("teams/recalculate", RankingsTeamsRecalculate.as_view()),
]
