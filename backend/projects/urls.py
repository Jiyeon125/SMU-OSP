from django.urls import path

from .views import ProjectDetail, ProjectMemberships, Projects


urlpatterns = [
    path("", Projects.as_view()),
    path("members", ProjectMemberships.as_view()),
    path("<int:pk>", ProjectDetail.as_view()),
]
