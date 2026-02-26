import { StudentTestView } from "../student-test.js";
import { InstructionSequenceRunner } from "../instruction.js";


export class IndividualTestView extends StudentTestView {

    mediaRecorder;
    recordedAudio;
    isPracticing = false;

    constructor(test, chatSocket, roomName, assignmentId, domElements, mediaRecorder) {
        super(test, chatSocket, roomName, assignmentId, domElements);
        this.mediaRecorder = mediaRecorder;
    }

    onChatMessage(data) {
        super.onChatMessage(data);
        if (data.event === "question.feedback") {
            this.teacherFeedback(data.correct);
        }
        if (data.event === "test.cancelled") {
            this.onTestComplete(true);
        }
    }

    async onTestComplete(cancelled = false) {
        if (this.mediaRecorder) {
            this.domElements.toggleAudioIndicator(false);
            await this.mediaRecorder.stop();
        }
        super.onTestComplete(cancelled);
    }

    // ---- Parts ----

    showPart(index) {
        this.domElements.showQuestionChallenge();
        const canShow = super.showPart(index);
        if (canShow) {
            console.log("Starting test part ", this.currentPart);
            this.domElements.showInstructions(this.currentPart.intro, this.currentPart.instructionsUrl);
            this.displayedAt = document.timeline.currentTime;
            this.showQuestion(this.isPracticing, 0);
        }
        return canShow;
    }

    onPartComplete() {
        this.answeredAt = document.timeline.currentTime;
        const duration = this.answeredAt - this.displayedAt;
        this.send({
            event: "part.complete",
            partIndex: this.currentPartIndex,
            partId: this.currentPart.id,
            duration: duration,
        });
        super.onPartComplete();
    }

    // ---- Questions ----
    showQuestion(isPracticing, questionIndex) {
        const canShow = this.setQuestion(isPracticing, questionIndex);
        if (canShow) {
            console.log("---------------------------------------------")
            console.log("Showing question " + this.currentPartIndex + "." + this.currentQuestionIndex);

            if (this.currentQuestion.instruction_sequence) {
                this.domElements.setStudentHeader('<i class="ph ph-ear"></i>');
            } else if (this.isPracticing) {
                this.domElements.setStudentHeader('<i class="ph ph-pencil-line"></i>');
            } else {
                this.domElements.hideStudentHeader();
            }

            // TODO: [#68981] Refactor this code somewhere else
            if (this.currentQuestion.instruction_sequence){
                console.log("---------------------------------------------")
                console.log("Starting instruction sequence: ", this.currentQuestion.instruction_sequence);
                this.domElements.lockInput();
                this.domElements.toggleBodyClass("show-instructions", true);

                this.domElements.setNextButtonListener(() => this.onQuestionComplete(this.currentQuestion));
                this.domElements.setRepeatButtonListener(() => this.repeat());

                const instructionRunner = new InstructionSequenceRunner(
                    this,
                    this.currentQuestion.instruction_sequence.instructions,
                    this.domElements,
                    this.audioContext
                );

                if (this.domElements.skipInstructionButton) {
                    this.domElements.skipInstructionButton.addEventListener("click", () => {
                        instructionRunner.skip();
                    });
                    this.domElements.skipAllInstructionsButton.addEventListener("click", () => {
                        instructionRunner.skipToEnd();
                    });
                    this.domElements.skipInstructionButton.style.display="block";
                    this.domElements.skipAllInstructionsButton.style.display="block";
                }

                instructionRunner.run().then(() => {
                    this.domElements.unlockInput();
                    if (this.domElements.skipInstructionButton) {
                        this.domElements.skipInstructionButton.style.display="none";
                        this.domElements.skipAllInstructionsButton.style.display="none";
                    }
                });
            } else {
                this.domElements.toggleBodyClass("show-instructions", false);
                if (Number(this.currentQuestion.timeout) > 1) {
                    if (this.questionTimeoutId) {
                        clearTimeout(this.questionTimeoutId);
                        this.questionTimeoutId = null;
                    }
                    this.questionTimeoutId = setTimeout(() => {
                        this.onQuestionComplete(this.currentQuestion, true);
                    }, this.currentQuestion.timeout);
                }
                if (Number(this.currentQuestion.reminder) > 1) {
                    if (this.questionReminderId) {
                        clearTimeout(this.questionReminderId);
                        this.questionReminderId = null;
                    }
                    this.questionReminderId = setTimeout(() => {
                        this.domElements.reminderSoundEl.currentTime = 0;
                        this.domElements.reminderSoundEl.play();
                    }, this.currentQuestion.reminder);
                }
                this.domElements.toggleNextButton(false);
                this.domElements.toggleRepeatButton(false);
            }

            this.displayedAt = document.timeline.currentTime;
            this.domElements.showQuestionChallenge(
                this.currentQuestion.challengeText,
                this.currentQuestion.challengeSoundUrl,
                this.currentQuestion.challengeImageUrl,
                this.audioContext
            );

            this.send({
                event: 'question.displayed',
                partIndex: this.currentPartIndex,
                partId: this.currentPart.id,
                questionIndex: this.currentQuestionIndex,
                questionId: this.currentQuestion.id,
                displayedAt: this.displayedAt,
                questionTitle: this.questionTitle(this.isPracticing),
                practice: this.isPracticing
            });

            this.domElements.toggleAudioIndicator(true);
            this.mediaRecorder.start();
        }
        return canShow;
    }

    onQuestionComplete() {
        const duration = this.answeredAt - this.displayedAt;
        let message = `Elev har gennemført spørgsmål ${this.currentPartIndex + 1}.${this.currentQuestionIndex + 1}`;
        if (this.isPracticing) {
            message = `Elev har gennemført øve-spørgsmål ${this.currentPartIndex + 1}.${this.currentQuestionIndex + 1}`;
        }
        this.send({
            event: "question.answered",
            message: message,
            choiceId: null,
            recordingBase64: this.recordedAudio,
            partIndex: this.currentPartIndex,
            partId: this.currentPart.id,
            questionIndex: this.currentQuestionIndex,
            questionId: this.currentQuestion.id,
            questionTitle: this.questionTitle(this.isPracticing),
            displayedAt: this.displayedAt,
            answeredAt: this.answeredAt,
            duration: duration,
            practice: this.isPracticing
        });
        this.answeredAt = document.timeline.currentTime;
        if (this.showNextQuestion()) {
            // Next question is being shown
        } else {
            if (this.isPracticing) {
                this.showFirstQuestion(false);
            } else {
                // no more questions in part
                this.onPartComplete();
            }
        }
    }

    async teacherFeedback(outcome) {
        this.answeredAt = document.timeline.currentTime;
        this.recordedAudio = await this.mediaRecorder.interval();
        this.onQuestionComplete();
    }

}
