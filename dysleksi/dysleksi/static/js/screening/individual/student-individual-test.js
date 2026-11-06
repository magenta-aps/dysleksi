import { StudentTestView } from "../student-test.js";
import { setupRecording } from "../media.js";

export class IndividualTestView extends StudentTestView {
    isPracticing = false;

    constructor(test, assignmentId, domElements, mediaRecorder, student) {
        super(test, assignmentId, domElements, student);
        setupRecording(this, mediaRecorder);
    }

    needsMicrophone() {
        return true;
    }

    onChatMessage(data) {
        super.onChatMessage(data);
        if (data.event === "question.feedback") {
            this.teacherFeedback(data.correct);
        }
        if (data.event === "question.changed") {
            if (data.partIndex !== this.currentPartIndex) {
                this.skipPart();
            } else {
                this.showQuestion(data.practice, data.questionIndex);
            }
        }
    }

    // ---- Questions ----
    async showQuestion(isPracticing, questionIndex) {
        const canShow = this.setQuestion(isPracticing, questionIndex);
        this.domElements.toggleNextButton(false);
        if (canShow) {
            // TODO: [#68981] Refactor this code somewhere else
            console.log("---------------------------------------------");
            console.log(
                "Showing question " +
                    this.currentPartIndex +
                    "." +
                    this.currentQuestionIndex,
                this.isPracticing ? "(practice)" : "(test)",
            );

            this.domElements.fadeScreenOverlay();
            this.setStudentHeader();
            this.updateNextButtonClass();
            this.domElements.showQuestionChallenge(
                this.currentQuestion.challengeText,
                this.currentQuestion.challengeSoundUrl,
                this.currentQuestion.challengeImageUrl,
                this.audioContext,
            );

            this.sendQuestionDisplayed();

            if (this.currentQuestion.instruction_sequence) {
                this.domElements.setNextButtonListener(() =>
                    this.onQuestionComplete(this.currentQuestion),
                );
                this.domElements.setRepeatButtonListener(() => this.repeat());
                await this.runInstructions();
            } else {
                this.setupReminder();
                this.domElements.toggleRepeatButton(false);
            }

            this.startAnswerTimer();

            this.audioDetector.addEventListener("audio.silent", this.onSilence);
            this.audioDetector.reset();

            //this.domElements.toggleAudioIndicator(true);
            this.mediaRecorder.start();
        }
        return canShow;
    }

    async onQuestionComplete() {
        const duration = this.answerDuration(this.answeredAt);
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
            practice: this.isPracticing,
        });
        this.answeredAt = document.timeline.currentTime;
        if (await this.showNextQuestion()) {
            // Next question is being shown
        } else {
            if (this.isPracticing) {
                // No more practice questions - proceed to test questions
                this.showFirstQuestion(false);
            } else {
                // no more questions in part
                this.onPartComplete();
            }
        }
    }

    async teacherFeedback() {
        this.answeredAt = document.timeline.currentTime;
        this.recordedAudio = await this.mediaRecorder.interval();
        this.onQuestionComplete();
    }
}
