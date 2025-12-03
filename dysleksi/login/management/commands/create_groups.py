# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from typing import Iterable, Type

from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Creates groups"

    def get_permissions(self, *modelactions: tuple[Type, Iterable[str]]):
        for model, actions in modelactions:
            content_type = ContentType.objects.get_for_model(
                model, for_concrete_model=False
            )
            for action in actions:
                yield Permission.objects.get(
                    codename=f"{action}_{content_type.model}",
                    content_type=content_type,
                )

    def set_group_permissions(self, group: Group, *permissions: Permission):
        for permission in permissions:
            group.permissions.add(permission)

    def handle(self, *args, **options):
        pass
