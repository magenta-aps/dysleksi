import { StudentTestView } from "../student-test.js";
import { InstructionSequenceRunner } from "../instruction.js";


export class IndividualTestView extends StudentTestView {

    mediaRecorder;
    recordedAudio;
    isPracticing = false;

    constructor(test, chatSocket, roomName, assignmentId, domElements, mediaRecorder, student) {
        super(test, chatSocket, roomName, assignmentId, domElements, student);
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
            //this.domElements.toggleAudioIndicator(false);
            await this.mediaRecorder.stop();
        }
        super.onTestComplete(cancelled);
    }

    // ---- Parts ----
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
            // TODO: [#68981] Refactor this code somewhere else
            console.log("---------------------------------------------")
            console.log("Showing question " + this.currentPartIndex + "." + this.currentQuestionIndex);

            this.setStudentHeader();
            this.updateNextButtonClass();

            if (this.currentQuestion.instruction_sequence){
                this.domElements.setNextButtonListener(() => this.onQuestionComplete(this.currentQuestion));
                this.domElements.setRepeatButtonListener(() => this.repeat());
                this.runInstructions(false);
            } else {
                this.setupNonPractice();
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

            //this.domElements.toggleAudioIndicator(true);
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
