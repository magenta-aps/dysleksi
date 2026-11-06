# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from django.core.exceptions import PermissionDenied
from django.core.management import call_command
from django.urls import reverse
from django.utils import translation

from dysleksi.models import (
    DYSLEXIA_TEST_ADULT,
    DYSLEXIA_TEST_CHILD,
    Correctness,
    CorrectnessCategory,
    PartResponse,
    PossibleAnswer,
    QuestionResponse,
    QuestionType,
    Test,
    TestAssignment,
    TestPart,
    TestQuestion,
    TestResource,
    TestResponse,
    TestType,
    User,
)
from dysleksi.tests.base import DysleksiTest
from dysleksi.views import AssignmentView, RootView


class DyslexiaTest(DysleksiTest):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.test_leader = cls.create_test_leader("testleder")
        cls.adult = cls.create_test_person("voksen", first_name="Voksen")
        cls.child = cls.create_test_person("barn", first_name="Barn")
        cls.adult_test = Test.objects.create(
            name=DYSLEXIA_TEST_ADULT, test_type=TestType.DYSLEXIA
        )
        cls.child_test = Test.objects.create(
            name=DYSLEXIA_TEST_CHILD, test_type=TestType.DYSLEXIA
        )
        cls.adult_test.parts.add(
            TestPart.objects.create(
                name="Lytteforståelse", timeout=0, partial_score_after=0
            )
        )
        cls.assignment = TestAssignment.objects.create(
            test=cls.adult_test, teacher=cls.test_leader, student=cls.adult
        )


class TestDyslexiaUsers(DyslexiaTest):
    def test_test_person(self):
        user = User.objects.get(pk=self.adult.pk)
        self.assertTrue(user.is_student)
        self.assertTrue(user.is_test_person)
        self.assertFalse(user.is_test_leader)
        self.assertEqual(user.user_type, "Testperson")
        self.assertEqual(user.subclass_instance(), self.adult)

    def test_test_leader(self):
        user = User.objects.get(pk=self.test_leader.pk)
        self.assertTrue(user.is_test_leader)
        self.assertFalse(user.is_teacher)
        self.assertFalse(user.is_student)
        self.assertEqual(user.user_type, "Testleder")
        self.assertEqual(user.subclass_instance(), self.test_leader)

    def test_assignment_permissions(self):
        other_test_leader = self.create_test_leader("other")
        self.assertTrue(self.assignment.has_permission(self.test_leader, "view"))
        self.assertTrue(self.assignment.has_permission(self.adult, "view"))
        self.assertFalse(self.assignment.has_permission(other_test_leader, "view"))
        self.assertFalse(self.assignment.has_permission(self.child, "view"))
        self.assertFalse(self.assignment.has_permission(self.teacher, "view"))


class TestChallengeImport(DyslexiaTest):
    def test_text_challenge_does_not_get_the_sound_of_another(self):
        challenges = []
        for data in (
            {"text": "meeraq", "sound": "resources/L607.mp3"},
            {"text": "meeraq"},
        ):
            part = TestPart.objects.create(name="Del", timeout=0, partial_score_after=0)
            part.update_or_create_test_resources(
                [{"question_type": "multiple_choice", **data}]
            )
            challenges.append(part.questions.get().challenge)

        self.assertNotEqual(challenges[0], challenges[1])
        self.assertEqual(challenges[1].sound, "")


class TestQuestionnaireOptions(DyslexiaTest):
    def test_every_option_is_correct(self):
        part = TestPart.objects.create(
            name="Spørgeskema", timeout=0, partial_score_after=0
        )
        part.update_or_create_test_resources(
            [
                {
                    "question_type": "multiple_choice",
                    "text": "Ilaannikkut?",
                    "text_da": "Nogle gange?",
                    "options": ["Qaqutikkut", "Ilaannikkut"],
                    "options_da": ["Sjældent", "Nogle gange"],
                    "locked_options": ["Qaqutikkut"],
                    "is_questionnaire": True,
                }
            ]
        )
        question = part.questions.get()
        self.assertTrue(question.is_questionnaire)
        self.assertQuerySetEqual(
            question.possible_answers.order_by("index").values_list(
                "resource__text", "correctness", "locked"
            ),
            [
                ("Qaqutikkut", Correctness.CORRECT, True),
                ("Ilaannikkut", Correctness.CORRECT, False),
            ],
        )

        # The test leader sees Danish texts, unless they have chosen Greenlandic
        option = question.possible_answers.get(index=1).resource
        for language, texts in (
            ("da", ("Nogle gange?", "Nogle gange")),
            ("kl", ("Ilaannikkut?", "Ilaannikkut")),
        ):
            with translation.override(language):
                self.assertEqual(
                    (question.challenge.localized_text, option.localized_text), texts
                )


class TestTestLeaderViews(DyslexiaTest):
    def test_lobby(self):
        view = self.setup_view(RootView, self.test_leader)
        self.assertEqual(view.get_template_names(), ["dysleksi/lobby/test_leader.html"])

        self.client.force_login(self.test_leader)
        response = self.client.get(reverse("dysleksi:root"))
        self.assertContains(response, "Tildel test")
        self.assertContains(response, self.adult.get_full_name())
        self.assertContains(response, self.child.get_full_name())
        self.assertContains(response, DYSLEXIA_TEST_ADULT)
        self.assertContains(response, DYSLEXIA_TEST_CHILD)

    def test_test_person_sees_a_blank_lobby(self):
        view = self.setup_view(RootView, self.adult)
        self.assertEqual(view.get_template_names(), ["dysleksi/lobby/student.html"])

    def test_start_test(self):
        self.client.force_login(self.test_leader)
        for test in (self.adult_test, self.child_test):
            with self.subTest(test=test):
                response = self.client.post(
                    reverse("dysleksi:start_dyslexia_test"),
                    {"test_person": self.adult.pk, "test": test.pk},
                )
                assignment = TestAssignment.objects.latest("pk")
                self.assertRedirects(
                    response,
                    reverse("dysleksi:room", kwargs={"pk": assignment.pk}),
                    fetch_redirect_response=False,
                )
                self.assertEqual(assignment.test, test)
                self.assertEqual(assignment.student_id, self.adult.pk)
                self.assertEqual(assignment.teacher_id, self.test_leader.pk)

    def test_start_test_without_test_person(self):
        self.client.force_login(self.test_leader)
        response = self.client.post(reverse("dysleksi:start_dyslexia_test"))
        self.assertEqual(response.status_code, 400)

    def test_only_test_leaders_start_tests(self):
        self.client.force_login(self.teacher)
        response = self.client.post(
            reverse("dysleksi:start_dyslexia_test"), {"test_person": self.adult.pk}
        )
        self.assertEqual(response.status_code, 403)

    def test_test_room(self):
        view = self.setup_view(AssignmentView, self.test_leader, pk=self.assignment.pk)
        self.assertEqual(
            view.get_template_names(),
            ["dysleksi/admin/test_assignment/detail_dyslexia.html"],
        )
        context = view.get_context_data()
        self.assertEqual(context["test_type"], "dyslexia")
        self.assertEqual(context["test_type_label"], "Dysleksitest")
        self.assertEqual(context["cancel_url"], reverse("dysleksi:root"))

        self.client.force_login(self.test_leader)
        response = self.client.get(
            reverse("dysleksi:room", kwargs={"pk": self.assignment.pk})
        )
        self.assertContains(response, 'data-test-type="dyslexia"')
        self.assertContains(response, 'id="note"')

    def test_test_person_room(self):
        view = self.setup_view(AssignmentView, self.adult, pk=self.assignment.pk)
        self.assertEqual(view.get_template_names(), ["dysleksi/screening/student.html"])

    def test_other_test_leaders_room(self):
        with self.assertRaises(PermissionDenied):
            self.setup_view(
                AssignmentView,
                self.create_test_leader("other"),
                pk=self.assignment.pk,
            )


class TestTestLeaderResults(DyslexiaTest):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        call_command("create_result_categories")
        cls.part = cls.adult_test.parts.get()
        cls.reading_part = TestPart.objects.create(
            name="Læs nonord højt", timeout=0, partial_score_after=0
        )
        cls.adult_test.parts.add(cls.reading_part)
        listening = TestQuestion.objects.create(
            part=cls.part,
            question_type=QuestionType.MULTIPLE_CHOICE,
            challenge=TestResource.objects.create(name="L056", sound="L056.mp3"),
        )
        answer = PossibleAnswer.objects.create(
            question=listening,
            resource=TestResource.objects.create(name="true", text="true"),
            correctness=Correctness.CORRECT,
        )
        reading = TestQuestion.objects.create(
            part=cls.reading_part,
            question_type=QuestionType.NO_INPUT_REQUIRED,
            challenge=TestResource.objects.create(name="ali", text="ali"),
        )
        cls.test_response = TestResponse.objects.create(
            assignment=cls.assignment, student=cls.adult, completed=True
        )
        cls.part_response = PartResponse.objects.create(
            testresponse=cls.test_response, testpart=cls.part, completed=True
        )
        QuestionResponse.objects.create(
            question=listening,
            partresponse=cls.part_response,
            answer_option=answer,
            correctness=Correctness.CORRECT,
        )
        cls.reading_part_response = PartResponse.objects.create(
            testresponse=cls.test_response, testpart=cls.reading_part, completed=True
        )
        cls.reading_response = QuestionResponse.objects.create(
            question=reading,
            partresponse=cls.reading_part_response,
            correctness=Correctness.SKIPPED,
            note="Ville ikke læse",
        )
        cls.other_assignment = TestAssignment.objects.create(
            test=cls.child_test,
            teacher=cls.create_test_leader("other"),
            student=cls.child,
        )

    def test_part_completed_by(self):
        self.assertEqual(
            self.part.to_json(self.assignment)["completed_by"], [self.adult.pk]
        )
        self.assertEqual(self.part.to_json(self.other_assignment)["completed_by"], [])

    def test_result_list(self):
        self.client.force_login(self.test_leader)
        response = self.client.get(reverse("dysleksi:test_assignment_result_list"))
        self.assertContains(response, self.adult.get_full_name())
        self.assertNotContains(response, self.child.get_full_name())
        self.assertContains(
            response,
            reverse(
                "dysleksi:test_assignment_results", kwargs={"pk": self.assignment.pk}
            ),
        )

    def test_unfinished_test_is_opened(self):
        TestResponse.objects.filter(pk=self.test_response.pk).update(completed=False)
        self.client.force_login(self.test_leader)
        response = self.client.get(reverse("dysleksi:test_assignment_result_list"))
        self.assertContains(
            response, reverse("dysleksi:room", kwargs={"pk": self.assignment.pk})
        )

    def test_listening_comprehension_shows_the_sound(self):
        self.client.force_login(self.test_leader)
        response = self.client.get(
            reverse(
                "dysleksi:test_assignment_part_result",
                kwargs={
                    "assignment_pk": self.assignment.pk,
                    "testpart_pk": self.part.pk,
                    "testresponse_pk": self.test_response.pk,
                },
            )
        )
        self.assertContains(response, "column-challenge-sound")
        self.assertNotContains(response, "column-challenge-image")
        self.assertNotContains(response, "column-challenge-sentence")

    def test_part_without_challenges_shows_no_challenge(self):
        TestQuestion.objects.filter(part=self.part).update(challenge=None)
        self.client.force_login(self.test_leader)
        response = self.client.get(
            reverse(
                "dysleksi:test_assignment_part_result",
                kwargs={
                    "assignment_pk": self.assignment.pk,
                    "testpart_pk": self.part.pk,
                    "testresponse_pk": self.test_response.pk,
                },
            )
        )
        self.assertNotContains(response, "column-challenge-")

    def test_questionnaire_has_no_correct_answer_or_score(self):
        questionnaire = TestPart.objects.create(
            name="Spørgeskema", timeout=0, partial_score_after=0
        )
        self.adult_test.parts.add(questionnaire)
        question = TestQuestion.objects.create(
            part=questionnaire,
            question_type=QuestionType.MULTIPLE_CHOICE,
            is_questionnaire=True,
            challenge=TestResource.objects.create(
                name="challenge", text="Tusaaniarnikkut ajornartorsiuteqarpit?"
            ),
        )
        QuestionResponse.objects.create(
            question=question,
            partresponse=PartResponse.objects.create(
                testresponse=self.test_response, testpart=questionnaire, completed=True
            ),
        )
        self.client.force_login(self.test_leader)

        def part_result(part):
            return self.client.get(
                reverse(
                    "dysleksi:test_assignment_part_result",
                    kwargs={
                        "assignment_pk": self.assignment.pk,
                        "testpart_pk": part.pk,
                        "testresponse_pk": self.test_response.pk,
                    },
                )
            )

        for text in ("Rigtigt svar", "Oversigt", "result-score"):
            self.assertNotContains(part_result(questionnaire), text)
            self.assertContains(part_result(self.reading_part), text)
        self.assertContains(part_result(questionnaire), "Spørgsmål")
        self.assertNotContains(part_result(self.reading_part), "Spørgsmål")

        student_results = self.client.get(
            reverse(
                "dysleksi:test_assignment_student_results",
                kwargs={
                    "assignment_pk": self.assignment.pk,
                    "response_pk": self.test_response.pk,
                },
            )
        )
        self.assertContains(student_results, "Spørgeskema")
        self.assertContains(student_results, "result-score", count=2)

    def test_results(self):
        self.client.force_login(self.test_leader)
        response = self.client.get(
            reverse(
                "dysleksi:test_assignment_results", kwargs={"pk": self.assignment.pk}
            )
        )
        student_results = reverse(
            "dysleksi:test_assignment_student_results",
            kwargs={
                "assignment_pk": self.assignment.pk,
                "response_pk": self.test_response.pk,
            },
        )
        self.assertRedirects(response, student_results)

        response = self.client.get(student_results)
        self.assertContains(response, "Lytteforståelse")
        self.assertContains(response, "Antal oversprungne")
        self.assertContains(response, reverse("dysleksi:test_assignment_result_list"))
        self.assertNotContains(response, reverse("dysleksi:class_list"))

        response = self.client.get(
            reverse(
                "dysleksi:test_assignment_part_result",
                kwargs={
                    "assignment_pk": self.assignment.pk,
                    "testpart_pk": self.reading_part.pk,
                    "testresponse_pk": self.test_response.pk,
                },
            )
        )
        self.assertContains(response, "Sprunget over")
        self.assertContains(response, "Ville ikke læse")

    def test_part_skipped_during_practice(self):
        part = TestPart.objects.create(
            name="Hvad er nonord?", timeout=0, partial_score_after=0
        )
        self.adult_test.parts.add(part)
        practice = TestQuestion.objects.create(
            part=part, question_type=QuestionType.MULTIPLE_CHOICE, is_practice=True
        )
        part_response = PartResponse.objects.create(
            testresponse=self.test_response, testpart=part, completed=True
        )
        QuestionResponse.objects.create(question=practice, partresponse=part_response)

        self.client.force_login(self.test_leader)
        response = self.client.get(
            reverse(
                "dysleksi:test_assignment_part_result",
                kwargs={
                    "assignment_pk": self.assignment.pk,
                    "testpart_pk": part.pk,
                    "testresponse_pk": self.test_response.pk,
                },
            )
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            part_response.correctness_category_answered, CorrectnessCategory.default()
        )

        response = self.client.get(
            reverse(
                "dysleksi:test_assignment_student_results",
                kwargs={
                    "assignment_pk": self.assignment.pk,
                    "response_pk": self.test_response.pk,
                },
            )
        )
        self.assertContains(response, "Lytteforståelse")
        self.assertNotContains(response, "Hvad er nonord?")

    def test_edit_note(self):
        self.client.force_login(self.test_leader)
        response = self.client.post(
            reverse("dysleksi:question_response_update"),
            {"pk": self.reading_response.pk, "attr": "note", "value": "Træt"},
        )
        self.assertEqual(response.status_code, 200)
        self.reading_response.refresh_from_db()
        self.assertEqual(self.reading_response.note, "Træt")

    def test_other_test_leaders_results(self):
        self.client.force_login(self.test_leader)
        response = self.client.get(
            reverse(
                "dysleksi:test_assignment_results",
                kwargs={"pk": self.other_assignment.pk},
            )
        )
        self.assertEqual(response.status_code, 403)


class TestAnswerDyslexiaTest(DyslexiaTest):
    def test_questionnaire_is_answered_with_an_open_option(self):
        question = TestQuestion.objects.create(
            part=self.adult_test.parts.get(),
            question_type=QuestionType.MULTIPLE_CHOICE,
            is_questionnaire=True,
        )
        PossibleAnswer.objects.create(
            question=question,
            resource=TestResource.objects.create(name="Qaqutikkut", text="Qaqutikkut"),
            correctness=Correctness.CORRECT,
            locked=True,
        )
        option = PossibleAnswer.objects.create(
            question=question,
            resource=TestResource.objects.create(
                name="Ilaannikkut", text="Ilaannikkut"
            ),
            correctness=Correctness.CORRECT,
        )

        call_command("answer_test", self.adult_test.pk, student=self.adult.pk)

        response = QuestionResponse.objects.get(question=question)
        self.assertEqual(response.correctness, Correctness.CORRECT)
        self.assertEqual(response.answer_option, option)
        self.assertEqual(response.partresponse.testresponse.assignment, self.assignment)
