import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from dysleksi.models import (
    Class,
    Correctness,
    PartResponse,
    QuestionResponse,
    QuestionType,
    Student,
    Test,
    TestAssignment,
    TestLeader,
    TestResponse,
    TestType,
)


class Command(BaseCommand):

    def add_arguments(self, parser):
        parser.add_argument(
            "pk",
            type=int,
            help="test pk",
        )
        parser.add_argument(
            "--class",
            type=int,
            help="class pk",
        )
        parser.add_argument(
            "--student",
            type=int,
            help="student pk",
        )

    @staticmethod
    def repeat_letter(text):
        index = random.randint(0, len(text) - 1)
        return text[0:index] + text[index - 1 :]

    @staticmethod
    def replace_letter(text):
        index = random.randint(0, len(text) - 1)
        letter = random.choice(
            [
                "a",
                "e",
                "f",
                "g",
                "i",
                "j",
                "k",
                "l",
                "m",
                "n",
                "o",
                "p",
                "q",
                "r",
                "s",
                "t",
                "u",
                "v",
            ]
        )
        return text[0:index] + letter + text[index - 1 :]

    def handle(self, *args, **options):
        test = Test.objects.get(pk=options["pk"])

        if test.test_type == TestType.GROUP:
            class_pk = options.get("class")
            if class_pk is None:
                print("Must specify --class for a group test")
                return
            klasse = Class.objects.get(pk=class_pk)
            assignment, _ = TestAssignment.objects.get_or_create(
                test=test, klasse=klasse, teacher=klasse.teachers.order_by("?").first()
            )
            students = klasse.students.all()
        else:
            student_pk = options.get("student")
            if student_pk is None:
                print("Must specify --student for an individual or dyslexia test")
                return
            student = Student.objects.get(pk=student_pk)
            if test.test_type == TestType.DYSLEXIA:
                teacher = TestLeader.objects.order_by("?").first()
            else:
                teacher = (
                    student.classes.order_by("?").first().teachers.order_by("?").first()
                )
            assignment, _ = TestAssignment.objects.get_or_create(
                test=test, student=student, teacher=teacher
            )
            students = Student.objects.filter(pk=student_pk)

        for student in students:
            skill = random.randint(1, 100)
            testresponse = TestResponse.objects.create(
                assignment=assignment, student=student, completed=True
            )
            time = timezone.now() - timedelta(hours=1)
            for i, testpart in enumerate(test.parts.all()):
                partresponse = PartResponse.objects.create(
                    testresponse=testresponse,
                    testpart=testpart,
                    finished_after=random.randint(2000, 10000),
                    completed=True,
                    started_at=time,
                )

                for question in testpart.questions.all():
                    # Any answer to a questionnaire counts as correct
                    correct = (
                        question.is_questionnaire or random.randint(1, 100) < skill
                    )

                    if testpart.has_partially_correct_answers:
                        correctness = (
                            random.choice([Correctness.CORRECT, Correctness.PARTIAL])
                            if correct
                            else Correctness.WRONG
                        )
                    else:
                        correctness = (
                            Correctness.CORRECT if correct else Correctness.WRONG
                        )

                    answer_text = None
                    if question.question_type == QuestionType.FREE_TEXT:
                        answer_option = (
                            question.possible_answers.filter(
                                correctness=(
                                    Correctness.PARTIAL
                                    if correctness == Correctness.PARTIAL
                                    else Correctness.CORRECT
                                )
                            )
                            .order_by("?")
                            .first()
                        )
                        if answer_option is not None:
                            answer_text = answer_option.resource.text
                            if not correct:
                                # Mangle the text a bit
                                for _ in range(random.randint(1, 5)):
                                    if bool(random.getrandbits(1)):
                                        answer_text = self.replace_letter(answer_text)
                                    else:
                                        answer_text = self.repeat_letter(answer_text)
                    else:
                        answer_option = (
                            question.possible_answers.filter(
                                correctness=correctness, locked=False
                            )
                            .order_by("?")
                            .first()
                        )
                    answer_time = timedelta(seconds=random.randint(3, 20))
                    time = time + answer_time

                    response = QuestionResponse.objects.create(
                        question=question,
                        partresponse=partresponse,
                        correctness=correctness,
                        answer_option=answer_option,
                        answer_text=answer_text,
                        finished_after=answer_time.seconds * 1000,
                    )
                    response.submitted_at = time
                    response.save()
