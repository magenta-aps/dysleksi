import { shuffleArray } from "../utils.js";
import { StudentTestView } from "../student-test.js";
import { InstructionSequenceRunner } from "../instruction.js";


export class GroupTestView extends StudentTestView {

    isPracticing = false;
    questionDisplayedAt;
    selectedAnswer;
    textAnswer;
    timeoutId;

    constructor(test, chatSocket, roomName, assignmentId, domElements) {
        super(test, chatSocket, roomName, assignmentId, domElements);
    }

    start() {
        super.start();
        this.domElements.setPracticeButtonListener(() => this.showFirstQuestion(true));
        this.domElements.setQuestionsButtonListener(() => this.showFirstQuestion(false));
        this.domElements.setNextButtonListener(() => this.onQuestionComplete(this.currentQuestion));
    }

    // ---- Parts ----

    showPart(partIndex) {
        const canShow = super.showPart(partIndex);
        if (canShow) {
            this.domElements.clearQuestionChoices();
            this.domElements.toggleNextButton(false);
            this.domElements.toggleQuestionsButton(true);
            this.domElements.togglePracticeButton(this.canPractice());
            this.domElements.showQuestionChallenge(
                this.challengeText,
                this.challengeSoundUrl,
                this.challengeImageUrl
            );
        }
        return canShow;
    }

    onPartComplete() {
        this.domElements.showQuestionTitle();
        this.domElements.clearQuestionChoices();
        this.domElements.toggleNextButton(false);
        this.domElements.togglePracticeButton(false);
        this.domElements.toggleQuestionsButton(false);
        super.onPartComplete();
    }

    canPractice() {
        return this.currentPart.practice.length > 0;
    }

    // ---- Questions ----

    showFirstQuestion(isPracticing) {
        const result = this.showQuestion(isPracticing, 0);
        if (result) {
            this.domElements.togglePracticeButton(false);
            if (!isPracticing) {
                this.domElements.toggleQuestionsButton(false);
            }
        }
        return result;
    }

    showQuestion(isPracticing, questionIndex) {
        const canShow = this.setQuestion(isPracticing, questionIndex);
        if (canShow) {
            console.log("---------------------------------------------")
            console.log("Showing question " + this.currentPartIndex+"."+this.currentQuestionIndex);
            this.domElements.toggleNextButton(false);
            this.domElements.clearQuestionChoices();
            this.domElements.showQuestionTitle(this.questionTitle());
            this.domElements.showQuestionChallenge(
                this.currentQuestion.challengeText,
                this.currentQuestion.challengeSoundUrl,
                this.currentQuestion.challengeImageUrl
            );
            this.selectedAnswer = null;
            this.textAnswer = null;
            let answers = this.currentQuestion.possibleAnswers;
            if (!this.isPracticing) {
                answers = shuffleArray(answers);
            }

            this.answerButtons = []
            for (let answer of answers) {
                if (this.currentQuestion.type === "multiple_choice"){
                    const button = this.domElements.showQuestionChoice(
                        answer.resourceText,
                        answer.resourceSoundUrl,
                        answer.resourceImageUrl,
                        () => {this.selectAnswer(answer)},
                    );
                    this.answerButtons.push({"button": button, "answer": answer});

                } else if (this.currentQuestion.type === "free_text"){
                    this.input = this.domElements.showQuestionFreeText(
                        null, null, null,
                        () => this.selectFreeText()
                    );
                }
            }
            if (this.currentQuestion.instruction_sequence){
                console.log("---------------------------------------------")
                console.log("Starting instruction sequence: ", this.instruction_sequence);
                this.domElements.lockInput();

                const instructionRunner = new InstructionSequenceRunner(
                    this.currentQuestion.instruction_sequence.instructions,
                    this.domElements
                );

                instructionRunner.run().then(() => {
                    this.domElements.unlockInput();
                });
            } else {
                if (Number(this.currentQuestion.timeout) > 1) {
                    this.timeoutId = setTimeout(() => {
                        this.onQuestionComplete(this.currentQuestion, true);
                    }, this.currentQuestion.timeout);
                }
                this.domElements.toggleNextButton(false);
            }

            this.questionDisplayedAt = document.timeline.currentTime;
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
        return canShow;
    }

    onQuestionComplete(question, outOfTime = false) {
        const questionAnsweredAt = document.timeline.currentTime;

        if (!question.instruction_sequence) {
            if (!this.selectedAnswer && !this.textAnswer && !outOfTime) {
                alert("Vælg et svar, før du går videre.");
                return;
            }
            if (this.isPracticing) {
                if (this.selectedAnswer.isCorrect) {
                    if (this.isLast()) {
                        alert("Øveopgaver gennemført. Begynd den rigtige test")
                    } else {
                        alert("Ja, det er rigtigt. Prøv næste øveopgave.");
                    }
                } else {
                    alert("Nej, det er forkert. Prøv at vælge igen.");
                    this.showQuestion(this.isPracticing, this.currentQuestionIndex);
                    return;
                }
            } else {
                clearTimeout(this.timeoutId);
                let messageText = `Elev har gennemført spørgsmål ${this.currentPartIndex + 1}.${this.currentQuestionIndex + 1}`
                if (outOfTime) {
                    messageText = `Elev besvarede ikke spørgsmål ${this.currentPartIndex + 1}.${this.currentQuestionIndex + 1} indenfor tidsfristen`
                }
                const duration = questionAnsweredAt - this.questionDisplayedAt;
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
                    correct: outOfTime ? false : this.answerIsCorrect(),
                    textAnswer: this.textAnswer,
                });
            }
        }

        if (this.showNextQuestion()) {
            // Next question is being shown
        } else {
            // no more questions in set
            if (this.isPracticing) {
                // finished practicing
                this.domElements.showQuestionTitle();
                this.domElements.showQuestionChallenge();
                this.domElements.toggleNextButton(false);
                this.domElements.clearQuestionChoices();
                this.domElements.toggleQuestionsButton(true);
            } else {
                // part complete
                this.onPartComplete();
            }
        }
    }

    questionTitle() {
        if (this.currentQuestion.instruction_sequence) {
            return "Instruks"
        } else {
            return `${this.currentQuestionIndex + 1}/${this.questionsCount()} (${this.currentPart.name})`;
        }
    }

    questionsCount() {
        return this.isPracticing ? this.currentPart.practice.length : this.currentPart.questions.length;
    }

    selectAnswer(answer) {
        this.selectedAnswer = answer;
        this.domElements.toggleNextButton(true);
        for (let a of this.answerButtons) {
            this.domElements.toggleButtonSelected(a["button"], a["answer"] === answer);
        }
    }

    answerIsCorrect() {
        if (this.textAnswer !== null) {
            const answer = this.currentQuestion.possibleAnswers[0];
            console.log("Checking answer: '"+ this.textAnswer +"','"+ answer.resourceText+"'");
            return this.textAnswer === answer.resourceText;
        } else {
            return this.selectedAnswer.isCorrect;
        }
    }
    selectFreeText() {
        const answer = this.input.textContent.trim();
        if (answer !== "") {
            this.textAnswer = answer;
            this.selectedAnswer = this.currentQuestion.possibleAnswers[0];
        }
        this.domElements.toggleNextButton(answer !== "");
    }

    isLast() {
        return this.currentQuestionIndex === this.questionsCount() - 1;
    }

}
