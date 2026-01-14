from typing import List

from django_tables2 import Table, tables

from dysleksi.models import Class


class ClassTable(Table):
    class Meta:
        model = Class
        fields: List[str] = []

    klasse = tables.Column(
        linkify=False,
        accessor="name",
    )
