import { GroupTestView } from "../group/student-group-test.js";
import { setupRecording } from "../media.js";

// The DyslexiaTestView is a hybrid between the individual and grouptest views.
// The student answers on screen like in a group test, while a test leader follows
// them in the control room like in an individual test. Words read aloud are
// recorded, and sent to a teacher as in an individual test. During a questionnaire
// we just show a question to the student, which the testleader answers (like in an
// individual test)
export class DyslexiaTestView extends GroupTestView {
    summaryVoiceOver = false;

    constructor(test, assignmentId, domElements, mediaRecorder, student) {
        super(test, assignmentId, domElements, student);
        setupRecording(this, mediaRecorder);
    }

    // Only a part in which the student reads aloud needs the microphone
    needsMicrophone() {
        return [...this.currentPart.practice, ...this.currentPart.questions].some(
            (question) => question.isReadAloud(),
        );
    }

    startSoundCalibration() {
        this.endSoundCalibration();
    }

    onChatMessage(data) {
        super.onChatMessage(data);
        if (data.event === "question.feedback") {
            if (this.currentQuestion.isQuestionnaire) {
                this.selectedAnswer = this.currentQuestion.possibleAnswers.find(
                    (answer) => answer.id === data.choiceId,
                );
                this.onQuestionComplete(this.currentQuestion);
            } else if (this.currentQuestion.isReadAloud()) {
                this.onQuestionComplete(this.currentQuestion);
            }
        }
        if (data.event === "question.changed") {
            if (data.partIndex !== this.currentPartIndex) {
                this.skipPart();
            } else {
                this.showQuestion(data.practice, data.questionIndex);
            }
        }
    }

    async showQuestion(isPracticing, questionIndex) {
        const canShow = await super.showQuestion(isPracticing, questionIndex);
        if (canShow && this.currentQuestion.isReadAloud()) {
            if (this.mediaRecorder.micLost) {
                // The microphone was lost before we got to this part.
                // Ask the student to restore it before proceeding.
                this.mediaRecorder.dispatchEvent(new Event("mic.lost"));
            } else {
                this.audioDetector.addEventListener("audio.silent", this.onSilence);
                this.audioDetector.reset();
                this.mediaRecorder.start();
            }
        }
        return canShow;
    }

    async onQuestionComplete(question = this.currentQuestion, outOfTime = false) {
        if (!question.isReadAloud()) {
            return super.onQuestionComplete(question, outOfTime);
        }
        this.answeredAt = document.timeline.currentTime;
        this.recordedAudio = await this.mediaRecorder.interval();
        this.send({
            event: "question.answered",
            choiceId: null,
            recordingBase64: this.recordedAudio,
            partIndex: this.currentPartIndex,
            partId: this.currentPart.id,
            questionIndex: this.currentQuestionIndex,
            questionId: question.id,
            questionTitle: this.questionTitle(this.isPracticing),
            displayedAt: this.displayedAt,
            answeredAt: this.answeredAt,
            duration: this.answerDuration(this.answeredAt),
            practice: this.isPracticing,
        });
        if (!(await this.showNextQuestion())) {
            if (this.isPracticing) {
                this.showFirstQuestion(false);
            } else {
                this.onPartComplete();
            }
        }
    }
}
