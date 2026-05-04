# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from django.core.management.base import BaseCommand

from dysleksi.models import (
    CategoryColorChoice,
    CorrectnessCategory,
    ReadingSpeedCategory,
)


class Command(BaseCommand):

    def create_correctness_categories(self):
        CorrectnessCategory.objects.get_or_create(
            id=1,
            is_default=True,
            color_key=CategoryColorChoice.GRAY,
            defaults={
                "upper_proportion_limit": None,
                "label_da": "Ikke fuldført",
            },
        )
        CorrectnessCategory.objects.get_or_create(
            id=2,
            is_default=False,
            color_key=CategoryColorChoice.RED,
            defaults={
                "upper_proportion_limit": 0.1,
                "label_da": "Betydeligt under middel",
            },
        )
        CorrectnessCategory.objects.get_or_create(
            id=3,
            is_default=False,
            color_key=CategoryColorChoice.YELLOW,
            defaults={
                "upper_proportion_limit": 0.35,
                "label_da": "Under middel",
            },
        )
        CorrectnessCategory.objects.get_or_create(
            id=4,
            is_default=False,
            color_key=CategoryColorChoice.GREEN,
            defaults={
                "upper_proportion_limit": 0.75,
                "label_da": "Middel",
            },
        )
        CorrectnessCategory.objects.get_or_create(
            id=5,
            is_default=False,
            color_key=CategoryColorChoice.BLUE,
            defaults={
                "upper_proportion_limit": 1,
                "label_da": "Over middel",
            },
        )

        CorrectnessCategory.validate_categories()

    def create_readingspeed_categories(self):
        ReadingSpeedCategory.objects.get_or_create(
            id=1,
            color_key=CategoryColorChoice.RED,
            defaults={
                "upper_proportion_limit": 0.1,
                "label_da": "Meget lavt",
            },
        )
        ReadingSpeedCategory.objects.get_or_create(
            id=2,
            color_key=CategoryColorChoice.YELLOW,
            defaults={
                "upper_proportion_limit": 0.35,
                "label_da": "Lavt",
            },
        )
        ReadingSpeedCategory.objects.get_or_create(
            id=3,
            color_key=CategoryColorChoice.GREEN,
            defaults={
                "upper_proportion_limit": 0.75,
                "label_da": "Middel",
            },
        )
        ReadingSpeedCategory.objects.get_or_create(
            id=4,
            color_key=CategoryColorChoice.BLUE,
            defaults={
                "upper_proportion_limit": 1,
                "label_da": "Højt",
            },
        )

        ReadingSpeedCategory.validate_categories()

    def handle(self, *args, **options):
        self.create_correctness_categories()
        self.create_readingspeed_categories()
