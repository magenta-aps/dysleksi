# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from django.core.management.base import BaseCommand

from dysleksi.models import ResultCategory, ResultCategoryChoice


class Command(BaseCommand):

    def handle(self, *args, **options):
        ResultCategory.objects.get_or_create(
            id=1,
            is_default=True,
            color_key=ResultCategoryChoice.GRAY,
            defaults={
                "upper_proportion_limit": None,
                "label_da": "Ikke fuldført",
            },
        )
        ResultCategory.objects.get_or_create(
            id=2,
            is_default=False,
            color_key=ResultCategoryChoice.RED,
            defaults={
                "upper_proportion_limit": 0.1,
                "label_da": "Betydeligt under middel",
            },
        )
        ResultCategory.objects.get_or_create(
            id=3,
            is_default=False,
            color_key=ResultCategoryChoice.YELLOW,
            defaults={
                "upper_proportion_limit": 0.35,
                "label_da": "Under middel",
            },
        )
        ResultCategory.objects.get_or_create(
            id=4,
            is_default=False,
            color_key=ResultCategoryChoice.GREEN,
            defaults={
                "upper_proportion_limit": 0.75,
                "label_da": "Middel",
            },
        )
        ResultCategory.objects.get_or_create(
            id=5,
            is_default=False,
            color_key=ResultCategoryChoice.BLUE,
            defaults={
                "upper_proportion_limit": 1,
                "label_da": "Over middel",
            },
        )

        ResultCategory.validate_categories()
