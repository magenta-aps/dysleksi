import { StudentTestView } from "../student-test.js";


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
            this.displayedAt = document.timeline.currentTime;
            this.domElements.showQuestionChallenge(
                this.currentQuestion.challengeText,
                this.currentQuestion.challengeSoundUrl,
                this.currentQuestion.challengeImageUrl
            );

            this.send({
                event: 'question.displayed',
                partIndex: this.currentPartIndex,
                partId: this.currentPart.id,
                questionIndex: this.currentQuestionIndex,
                questionId: this.currentQuestion.id,
                displayedAt: this.displayedAt,
                questionTitle: this.questionTitle(),
            });

            this.domElements.toggleAudioIndicator(true);
            this.mediaRecorder.start();
        }
        return canShow;
    }

    onQuestionComplete() {
        const duration = this.answeredAt - this.displayedAt;
        this.send({
            event: "question.answered",
            message: `Elev har gennemført spørgsmål ${this.currentPartIndex + 1}.${this.currentQuestionIndex + 1}`,
            choiceId: null,
            recordingBase64: this.recordedAudio,
            partIndex: this.currentPartIndex,
            partId: this.currentPart.id,
            questionIndex: this.currentQuestionIndex,
            questionId: this.currentQuestion.id,
            questionTitle: this.questionTitle(),
            displayedAt: this.displayedAt,
            answeredAt: this.answeredAt,
            duration: duration
        });
        this.answeredAt = document.timeline.currentTime;
        if (this.showNextQuestion()) {
            // Next question is being shown
        } else {
            // no more questions in part
            this.onPartComplete();
        }
    }

    async teacherFeedback(outcome) {
        this.answeredAt = document.timeline.currentTime;
        this.recordedAudio = await this.mediaRecorder.interval();
        this.onQuestionComplete();
    }

}
