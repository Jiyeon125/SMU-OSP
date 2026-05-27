from django.db.models.signals import post_save
from django.dispatch import receiver

from users.models import User
from users.tasks import initial_process


@receiver(post_save, sender=User)
def user_post_save(sender, instance, created, **kwargs):
    if created:
        print(f"User {instance.username} created")
        try:
            initial_process.delay(instance.username)
        except Exception as e:
            # PoC: Celery broker(Redis)가 없거나 GH_PAT 미설정 시 가입 자체는 막지 않음
            print(f"[signals] initial_process dispatch skipped: {e}")
