from django.db import migrations
from django.db.models import Exists, OuterRef


def mark_answered_parts_completed(apps, schema_editor):
    """Group tests never sent "part.complete". Parts used to count as completed when
    every question was answered"""
    PartResponse = apps.get_model("dysleksi", "PartResponse")
    TestQuestion = apps.get_model("dysleksi", "TestQuestion")
    QuestionResponse = apps.get_model("dysleksi", "QuestionResponse")

    unanswered = TestQuestion.objects.filter(
        part=OuterRef("testpart"), is_practice=False
    ).exclude(
        Exists(
            QuestionResponse.objects.filter(
                question=OuterRef("pk"), partresponse=OuterRef(OuterRef("pk"))
            )
        )
    )
    PartResponse.objects.filter(completed=False).exclude(Exists(unanswered)).update(
        completed=True
    )


class Migration(migrations.Migration):

    dependencies = [
        ("dysleksi", "0044_testleader_testperson_alter_testpart_options_and_more"),
    ]

    operations = [
        migrations.RunPython(mark_answered_parts_completed, migrations.RunPython.noop),
    ]
