import { shuffleArray } from "../utils.js";
import { StudentTestView } from "../student-test.js";
import { calculateStudentProgress } from '../utils.js';

export class GroupTestView extends StudentTestView {

    questionDisplayedAt;
    selectedAnswer;
    textAnswer;
    questionTimeoutId;
    partTimeoutId;

    constructor(test, chatSocket, roomName, assignmentId, domElements, student) {
        super(test, chatSocket, roomName, assignmentId, domElements, student);
    }

    start() {
        super.start();
        this.domElements.setNextButtonListener(() => this.onQuestionComplete(this.currentQuestion, false));
    }

    // ---- Parts ----
    onPartComplete() {
        this.domElements.clearQuestionChoices();
        this.domElements.toggleNextButton(false);

        super.onPartComplete();
    }

    onPartTimeout() {
        const remainingQuestions = this.currentPart.questions.slice(this.currentQuestionIndex);
        remainingQuestions.forEach((question) => {
            this.onQuestionComplete(question, true);
        });
    }

    // ---- Questions ----
    showQuestion(isPracticing, questionIndex) {
        const canShow = this.setQuestion(isPracticing, questionIndex);
        if (canShow) {
            console.log("---------------------------------------------")
            console.log("Showing question " + this.currentPartIndex+"."+this.currentQuestionIndex, "(practicing=",isPracticing,")", "type:", this.currentQuestion.type, this.currentQuestion);

            this.setStudentHeader();
            this.domElements.toggleRepeatButton(false);
            this.domElements.toggleNextButton(false);

            // Show question challenge and choices
            this.domElements.toggleQuestionDisplay("flex");
            this.updateNextButtonClass();

            this.domElements.clearQuestionChoices();
            const domEls = this.domElements.showQuestionChallenge(
                this.currentQuestion.challengeText,
                this.currentQuestion.challengeSoundUrl,
                this.currentQuestion.challengeImageUrl,
                this.audioContext
            );
            this.selectedAnswer = null;
            this.textAnswer = null;
            let answers = this.currentQuestion.possibleAnswers;
            if (!this.isPracticing) {
                answers = shuffleArray(answers);
            }

            if (this.currentQuestion.type === "multiple_choice") {
                this.answerButtons = []
                for (let answer of answers) {
                        const button = this.domElements.showQuestionChoice(
                            answer,
                            () => {this.selectAnswer(answer)}
                        );
                        this.answerButtons.push({"button": button, "answer": answer});
                }
            } else if (this.currentQuestion.type === "free_text"){
                this.input = this.domElements.showQuestionFreeText(
                    () => this.selectFreeText()
                );
            }

            if (this.currentQuestion.instruction_sequence){
                this.runInstructions(true);
            } else {
                this.setupNonPractice();

                // If question challenge has a sound, it also has a play button
                // "Click" the play button to play the sound immediately, as well as
                // performing the expected DOM updates.
                if (this.currentQuestion.challengeSoundUrl && domEls.playBtn) {
                    console.log("Playing challenge sound", this.currentQuestion.challengeSoundUrl);
                    domEls.playBtn.click();
                }
            }
            this.questionDisplayedAt = document.timeline.currentTime;
            if (!this.isPracticing) {
                this.send({
                    event: 'question.displayed',
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

    onQuestionComplete(question, outOfTime = false) {
        const questionAnsweredAt = document.timeline.currentTime;

        // Hide the image to avoid leaking into the next question
        this.domElements.hideChallengeImage()

        if (!question.instruction_sequence) {
            if (!this.selectedAnswer && !this.textAnswer && !outOfTime) {
                alert("Vælg et svar, før du går videre.");
                return;
            }

            if (this.questionReminderId) {
                clearTimeout(this.questionReminderId);
                this.questionReminderId = null;
            }

            if (this.isPracticing) {
                if (!this.textAnswer && !this.answerIsCorrect()) {
                    // Wrong answer
                    this.domElements.makeButtonAngry("next");
                    return;
                }
            } else {
                let messageText = `Elev har gennemført spørgsmål ${this.currentPartIndex + 1}.${this.currentQuestionIndex + 1}`
                if (outOfTime) {
                    messageText = `Elev besvarede ikke spørgsmål ${this.currentPartIndex + 1}.${this.currentQuestionIndex + 1} indenfor tidsfristen`
                }
                const duration = questionAnsweredAt - this.questionDisplayedAt;
                this.student.progress = calculateStudentProgress(this.test, this.currentPartIndex, this.currentQuestionIndex);

                const correct = outOfTime ? false : this.answerIsCorrect()
                this.student.addResult(this.currentPartIndex, correct);

                this.send({
                    event: "question.answered",
                    message: messageText,
                    choiceId: outOfTime ? null : this.selectedAnswer.id,
                    recordingBase64: null,
                    partIndex: this.currentPartIndex,
                    partId: this.currentPart.id,
                    questionIndex: this.currentQuestionIndex,
                    questionId: this.currentQuestion.id,
                    questionTitle: this.questionTitle(),
                    displayedAt: this.questionDisplayedAt,
                    answeredAt: questionAnsweredAt,
                    duration: duration,
                    correct: correct,
                    textAnswer: this.textAnswer,
                });
            }
        }

        if (this.questionTimeoutId) {
            clearTimeout(this.questionTimeoutId);
            this.questionTimeoutId = null;
        }

        if (this.showNextQuestion()) {
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

    selectAnswer(answer) {
        this.selectedAnswer = answer;
        this.domElements.toggleNextButton(true);

        if (this.isPracticing) {
            if (this.selectedAnswer.isCorrect){
                this.domElements.makeButtonHappy(this.selectedAnswer.buttonId)
                this.domElements.enableNextButton()
            } else {
                this.domElements.makeButtonAngry(this.selectedAnswer.buttonId)
                this.domElements.disableNextButton()
                // Play "you guessed wrong" sound snippet
                let source = null;
                this.domElements.playSound('/static/audio/7c.1a.wav', source, this.audioContext);
            }
        } else {
            this.domElements.makeButtonGlow(this.selectedAnswer.buttonId)
        }

        for (let a of this.answerButtons) {
            this.domElements.toggleButtonSelected(a["button"], a["answer"] === answer);
        }
    }

    answerIsCorrect() {
        if (this.textAnswer !== null) {
            const answer = this.currentQuestion.possibleAnswers[0];
            return this.compareTextAnswer(this.textAnswer, answer.resourceText);
        } else {
            return this.selectedAnswer.isCorrect;
        }
    }
    selectFreeText() {
        clearTimeout(this.questionReminderId);
        const answer = this.input.value.trim();
        if (answer !== "") {
            this.textAnswer = answer;
            this.selectedAnswer = this.currentQuestion.possibleAnswers[0];
        }
        this.domElements.toggleNextButton(this.showingInstructions || answer.length >= 2);
    }

    regexWhitespaces = /\s+/g;

    #preprocessTextAnswer(textAnswer) {
        textAnswer = textAnswer.toLowerCase().replaceAll(this.regexWhitespaces, "");
        const consonants = "bcdfghjklmnpqrstvwxz";
        for (let c of consonants) {
            textAnswer = textAnswer.replaceAll(c+c, c);
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
