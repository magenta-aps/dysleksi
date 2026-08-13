import { StudentTestView } from "../student-test.js";
import { calculateStudentProgress, isVisible } from "../utils.js";
import { gettext } from "../../i18n.js";

export class GroupTestView extends StudentTestView {
    questionDisplayedAt;
    selectedAnswer;
    textAnswer;
    questionTimeoutId;
    partTimeoutId;

    constructor(test, chatSocket, assignmentId, domElements, student) {
        super(test, chatSocket, assignmentId, domElements, student);
    }

    start() {
        super.start();
        this.domElements.setNextButtonListener(() =>
            this.onQuestionComplete(this.currentQuestion, false),
        );
        document.addEventListener("click", (e) => this.handleOutsideClick(e));
    }

    // ---- Parts ----
    onPartComplete() {
        this.domElements.clearQuestionChoices();
        this.domElements.toggleNextButton(false);

        super.onPartComplete();
    }

    onPartTimeout() {
        const remainingQuestions = this.currentPart.questions.slice(
            this.currentQuestionIndex,
        );
        remainingQuestions.forEach((question) => {
            this.onQuestionComplete(question, true);
        });
    }

    // ---- Questions ----
    async showQuestion(isPracticing, questionIndex) {
        const canShow = this.setQuestion(isPracticing, questionIndex);
        if (canShow) {
            console.log("---------------------------------------------");
            console.log(
                "Showing question " +
                    this.currentPartIndex +
                    "." +
                    this.currentQuestionIndex,
                "(practicing=",
                isPracticing,
                ")",
                "type:",
                this.currentQuestion.type,
                this.currentQuestion,
            );

            this.domElements.fadeScreenOverlay();
            this.setStudentHeader();
            this.domElements.toggleRepeatButton(false);
            this.domElements.toggleNextButton(false);
            this.failedAttempts = 0;

            // Show question challenge and choices
            this.domElements.toggleQuestionDisplay("flex");

            // Display 'next' button as green rectangle with arrow
            this.endedInstructions = false;
            this.updateNextButtonClass();

            this.domElements.clearQuestionChoices();
            const domEls = this.domElements.showQuestionChallenge(
                this.currentQuestion.challengeText,
                this.currentQuestion.challengeSoundUrl,
                this.currentQuestion.challengeImageUrl,
                this.audioContext,
            );
            this.selectedAnswer = null;
            this.textAnswer = null;
            this.isMatchPair = false;
            let answers = this.currentQuestion.possibleAnswers;
            if (
                answers.some((a) => a.resourceText === "true") &&
                answers.some((a) => a.resourceText === "false")
            ) {
                // Order True/False such that True always appears first
                const trueAnswer = answers.find((a) => a.resourceText === "true");
                const falseAnswer = answers.find((a) => a.resourceText === "false");
                answers = [trueAnswer, falseAnswer];
            }

            if (this.currentQuestion.type === "multiple_choice_match") {
                this.domElements.multipleChoiceMatchContainer.style.display = "flex";
            } else {
                this.domElements.multipleChoiceMatchContainer.style.display = "none";
            }

            if (
                this.currentQuestion.type === "multiple_choice" ||
                this.currentQuestion.type === "multiple_choice_with_display_field"
            ) {
                this.answerButtons = [];
                answers.forEach((answer) => {
                    const button = this.domElements.showQuestionChoice(
                        answer,
                        () => {
                            this.selectAnswer(answer);
                        },
                        answers.length,
                        this.domElements.choicesEl,
                        answers.length < 6 &&
                            answers.some((a) => a.resourceText?.length === 1),
                    );
                    if (this.currentQuestion.challengeSoundUrl) {
                        button.disabled = true;
                    }
                    this.answerButtons.push({ button: button, answer: answer });
                });
            } else if (this.currentQuestion.type === "free_text") {
                this.input = this.domElements.showQuestionFreeText(() =>
                    this.selectFreeText(),
                );
            } else if (this.currentQuestion.type === "multiple_choice_match") {
                this.answerButtons = [];
                this.isMatchPair = true;

                const set1Answers = answers.filter((a) =>
                    a.resourceName.endsWith("set1"),
                );
                const set2Answers = answers.filter((a) =>
                    a.resourceName.endsWith("set2"),
                );

                const renderGroup = (groupAnswers, container) => {
                    for (let answer of groupAnswers) {
                        const button = this.domElements.showQuestionChoice(
                            answer,
                            () => this.selectAnswer(answer),
                            groupAnswers.length,
                            container,
                        );
                        this.answerButtons.push({ button: button, answer: answer });
                    }
                };

                renderGroup(set1Answers, this.domElements.choicesElLeft);
                renderGroup(set2Answers, this.domElements.choicesElRight);
            }

            if (this.currentQuestion.instruction_sequence) {
                await this.runInstructions(() => {
                    if (this.currentQuestion.continueWhenInstructionIsComplete) {
                        // Prompt user to go to next question (by removing the question elements)
                        // (This is the default behavior.)
                        this.domElements.toggleQuestionDisplay("none");
                        console.debug("Hiding current question");
                    } else {
                        // Keep the question on screen - the user must give an answer
                        // before they can continue.
                        console.debug("Waiting for user input ...");
                        this.playChallengeSound(domEls.playBtn);
                        this.setupReminder();
                    }
                });
            }

            // Play challenge sound (this handles the case where the question does not have an instruction sequence)
            if (
                this.currentQuestion.instruction_sequence === null ||
                !this.currentQuestion.instruction_sequence
            ) {
                this.playChallengeSound(domEls.playBtn);
                this.setupReminder();
            }

            this.questionDisplayedAt = document.timeline.currentTime;

            // When we are no longer practicing, disable the CSS rules used during
            // instructions and practice questions.
            if (!this.isPracticing) {
                this.domElements.toggleBodyClass("show-instructions", false);
            }

            if (!this.isPracticing) {
                // It is important to only send this when displaying real questions, not practice,
                // because we save the timestamp and compare it to answer timestamps of the questions
                this.send({
                    event: "question.displayed",
                    partIndex: this.currentPartIndex,
                    partId: this.currentPart.id,
                    questionIndex: this.currentQuestionIndex,
                    questionId: this.currentQuestion.id,
                    displayedAt: this.questionDisplayedAt,
                    questionTitle: this.questionTitle(),
                });
            }
        }

        return canShow;
    }

    playChallengeSound(playBtn) {
        // If question challenge has a sound, it also has a play button.
        // "Click" the play button to play the sound as well as performing the expected DOM updates.
        if (this.currentQuestion.challengeSoundUrl && playBtn) {
            setTimeout(() => {
                console.log(
                    "Playing challenge sound",
                    this.currentQuestion.challengeSoundUrl,
                );
                playBtn.click();
            }, 500);
        }
    }

    async onQuestionComplete(question, outOfTime = false) {
        const questionAnsweredAt = document.timeline.currentTime;
        this.domElements.interruptSound();

        if (
            !(
                question.continueWhenInstructionIsComplete &&
                question.instruction_sequence
            )
        ) {
            if (!this.selectedAnswer && !this.textAnswer && !outOfTime) {
                alert(gettext("Vælg et svar, før du går videre."));
                return;
            }

            this.clearReminder();

            if (this.isPracticing) {
                if (!this.textAnswer || this.isMatchPair) {
                    if (this.answerIsCorrect()) {
                        this.domElements.lockInput();
                        this.getSelectedButtons().forEach((btn) =>
                            this.domElements.makeButtonHappy(btn.id),
                        );

                        // Play "you guessed correct" sound snippet
                        await this.domElements.playSound(
                            this.currentPart.practiceCorrectFeedbackSource ||
                                "/static/audio/7c.4.wav",
                            this.audioContext,
                        );
                        this.domElements.unlockInput();
                    } else {
                        this.failedAttempts += 1;

                        if (this.isMatchPair && this.failedAttempts == 3) {
                            const correctLeft = this.answerButtons.find(
                                (a) =>
                                    this.domElements.choicesElLeft.contains(a.button) &&
                                    a.answer.correctness === "correct",
                            );
                            const correctRight = this.answerButtons.find(
                                (a) =>
                                    this.domElements.choicesElRight.contains(
                                        a.button,
                                    ) && a.answer.correctness === "correct",
                            );

                            console.log("Playing hint audio");
                            this.domElements.playSound(
                                this.currentQuestion.hintSource,
                                this.audioContext,
                            );

                            console.log("Highlighting correct answer");
                            if (!correctLeft.button.classList.contains("selected")) {
                                correctLeft.button.classList.add("pulse");
                            }
                            if (!correctRight.button.classList.contains("selected")) {
                                correctRight.button.classList.add("pulse");
                            }
                        } else {
                            this.getSelectedButtons().forEach((btn) =>
                                this.domElements.makeButtonAngry(btn.id),
                            );
                            // Play "you guessed wrong" sound snippet
                            this.domElements.playSound(
                                this.currentPart.practiceWrongFeedbackSource ||
                                    "/static/audio/7c.3.wav",
                                this.audioContext,
                            );
                        }

                        return;
                    }
                }
            } else {
                let messageText = `Elev har gennemført spørgsmål ${this.currentPartIndex + 1}.${this.currentQuestionIndex + 1}`;
                if (outOfTime) {
                    messageText = `Elev besvarede ikke spørgsmål ${this.currentPartIndex + 1}.${this.currentQuestionIndex + 1} indenfor tidsfristen`;
                }
                const duration = questionAnsweredAt - this.questionDisplayedAt;
                this.student.progress = calculateStudentProgress(
                    this.test,
                    this.currentPartIndex,
                    this.currentQuestionIndex,
                );

                const correctness = outOfTime ? "wrong" : this.answerCorrectness();
                this.student.addResult(this.currentPartIndex, correctness);

                this.send({
                    event: "question.answered",
                    message: messageText,
                    choiceId: outOfTime
                        ? null
                        : this.selectedAnswer && this.selectedAnswer.id,
                    recordingBase64: null,
                    partIndex: this.currentPartIndex,
                    partId: this.currentPart.id,
                    questionIndex: this.currentQuestionIndex,
                    questionId: this.currentQuestion.id,
                    questionTitle: this.questionTitle(),
                    displayedAt: this.questionDisplayedAt,
                    answeredAt: questionAnsweredAt,
                    duration: duration,
                    correctness: correctness,
                    textAnswer: this.textAnswer,
                });
            }
        }

        this.clearTimeout();

        // Hide the image to avoid leaking into the next question
        this.domElements.hideChallengeImage();

        if (await this.showNextQuestion()) {
            // Next question is being shown
        } else {
            // no more questions in set
            if (this.isPracticing) {
                // finished practicing
                this.domElements.showQuestionChallenge();
                this.domElements.clearQuestionChoices();
                this.domElements.hideStudentHeader();

                // Show repeat and next buttons
                this.domElements.toggleRepeatButton(true);
                this.domElements.toggleNextButton(true);

                this.currentQuestionIndex = 0;
                this.showFirstQuestion(false);
            } else {
                // part complete
                this.onPartComplete();
            }
        }
    }

    getSelectedButtons() {
        if (!this.answerButtons) return [];
        return this.answerButtons
            .filter(
                (a) => a.button.classList.contains("selected") && isVisible(a.button),
            )
            .map((a) => a.button);
    }

    handleOutsideClick(e) {
        if (
            !e.target.closest("button") &&
            !this.showingInstructions &&
            !this.domElements.inputLocked
        ) {
            this.getSelectedButtons().forEach((btn) => this.unselectAnswer(btn));
        }
    }

    unselectAnswer(btn) {
        this.domElements.toggleButtonSelected(btn, false);
        this.domElements.toggleNextButton(false);
        this.selectedAnswer = null;
        this.textAnswer = null;

        btn.classList.add("no-hover");
        btn.addEventListener("pointerleave", () => btn.classList.remove("no-hover"), {
            once: true,
        });

        this.answerButtons.forEach((a) => {
            a.button.classList.remove("dimmed");
        });
    }

    selectAnswer(answer) {
        this.selectedAnswer = answer;
        let leftSelectedEntry;
        let rightSelectedEntry;

        const clickedEntry = this.answerButtons.find((a) => a.answer === answer);
        const wasSelected = clickedEntry.button.classList.contains("selected");

        if (wasSelected) {
            this.unselectAnswer(clickedEntry.button);
            return;
        }

        if (this.isMatchPair) {
            const parentColumn = clickedEntry.button.parentElement;

            this.answerButtons.forEach((a) => {
                if (a.button.parentElement === parentColumn) {
                    this.domElements.toggleButtonSelected(
                        a.button,
                        a.answer === answer,
                    );
                }
            });

            leftSelectedEntry = this.answerButtons.find(
                (a) =>
                    this.domElements.choicesElLeft.contains(a.button) &&
                    a.button.classList.contains("selected"),
            );

            rightSelectedEntry = this.answerButtons.find(
                (a) =>
                    this.domElements.choicesElRight.contains(a.button) &&
                    a.button.classList.contains("selected"),
            );

            if (leftSelectedEntry && rightSelectedEntry) {
                this.domElements.toggleNextButton(true);
                this.textAnswer =
                    leftSelectedEntry.answer.resourceText +
                    rightSelectedEntry.answer.resourceText;
                this.selectedAnswer = null;
            }
        } else {
            this.domElements.toggleNextButton(true);
            for (let a of this.answerButtons) {
                this.domElements.toggleButtonSelected(
                    a["button"],
                    a["answer"] === answer,
                );
            }
        }

        clickedEntry.button.classList.remove("pulse");
        if (this.selectedAnswer !== null) {
            this.domElements.makeButtonGlow(this.selectedAnswer.buttonId);
        }

        if (answer.resourceText === "true" || answer.resourceText === "false") {
            this.answerButtons.forEach((a) => {
                if (a.answer === answer) {
                    a.button.classList.remove("dimmed");
                } else {
                    a.button.classList.add("dimmed");
                }
            });
        }
    }

    answerIsCorrect() {
        return this.answerCorrectness() === "correct";
    }

    answerCorrectness() {
        if (this.textAnswer !== null) {
            for (const answer of this.currentQuestion.possibleAnswers) {
                if (this.compareTextAnswer(this.textAnswer, answer.resourceText)) {
                    return answer.correctness;
                }
            }
            return "wrong";
        } else {
            return this.selectedAnswer.correctness;
        }
    }
    selectFreeText() {
        clearTimeout(this.questionReminderId);
        const answer = this.input.value.trim();
        if (answer !== "") {
            this.textAnswer = answer;
            this.selectedAnswer = this.currentQuestion.possibleAnswers[0];
        }
        this.domElements.toggleNextButton(
            this.showingInstructions || answer.length >= 1,
            true,
        );
    }

    regexWhitespaces = /\s+/g;

    #preprocessTextAnswer(textAnswer) {
        textAnswer = textAnswer.toLowerCase().replaceAll(this.regexWhitespaces, "");
        const consonants = "bcdfghjklmnpqrstvwxz";
        for (let c of consonants) {
            textAnswer = textAnswer.replaceAll(c + c, c);
        }
        // TODO: Hvilke andre enslydende bogstaver skal tælle som værende "ens"
        textAnswer = textAnswer.replaceAll("i", "e");
        return textAnswer;
    }

    compareTextAnswer(userAnswer, correctAnswer) {
        userAnswer = this.#preprocessTextAnswer(userAnswer);
        correctAnswer = this.#preprocessTextAnswer(correctAnswer);
        return userAnswer === correctAnswer;
    }
}
