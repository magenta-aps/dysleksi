import { StudentTestView } from "../student-test.js";
import { AudioDetector } from "../media.js";

export class IndividualTestView extends StudentTestView {
    mediaRecorder;
    audioDetector;
    recordedAudio;
    isPracticing = false;

    constructor(test, assignmentId, domElements, mediaRecorder, student) {
        super(test, assignmentId, domElements, student);
        this.mediaRecorder = mediaRecorder;
        this.audioDetector = new AudioDetector(this.mediaRecorder.stream);
        for (const event of ["audio.detected", "audio.quiet"]) {
            this.audioDetector.addEventListener(event, (e) => {
                this.onAudioEvent(e.type);
            });
        }
        this.audioDetector.run();
    }

    onAudioEvent(event) {
        // Pass audio events on to teacher's session
        this.send({ event: event });
    }

    onChatMessage(data) {
        super.onChatMessage(data);
        if (data.event === "question.feedback") {
            this.teacherFeedback(data.correct);
        }
        if (data.event === "question.changed") {
            // If teacher changes current test part, tell the student that this
            // test part is complete and the next test part will begin shortly.
            if (data.partIndex !== this.currentPartIndex) {
                this.onPartComplete();
            }
            this.showQuestion(data.practice, data.questionIndex);
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
            );

            this.domElements.fadeScreenOverlay();
            this.setStudentHeader();
            this.updateNextButtonClass();

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

            this.displayedAt = document.timeline.currentTime;
            this.domElements.showQuestionChallenge(
                this.currentQuestion.challengeText,
                this.currentQuestion.challengeSoundUrl,
                this.currentQuestion.challengeImageUrl,
                this.audioContext,
            );
            this.send({
                event: "question.displayed",
                partIndex: this.currentPartIndex,
                partId: this.currentPart.id,
                questionIndex: this.currentQuestionIndex,
                questionId: this.currentQuestion.id,
                displayedAt: this.displayedAt,
                questionTitle: this.questionTitle(this.isPracticing),
                practice: this.isPracticing,
            });

            this.audioDetector.addEventListener("audio.silent", (e) => {
                this.onAudioEvent(e.type);
            });

            //this.domElements.toggleAudioIndicator(true);
            this.mediaRecorder.start();
        }
        return canShow;
    }

    async onQuestionComplete() {
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
            practice: this.isPracticing,
        });
        this.answeredAt = document.timeline.currentTime;
        if (await this.showNextQuestion()) {
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

    async teacherFeedback() {
        this.answeredAt = document.timeline.currentTime;
        this.recordedAudio = await this.mediaRecorder.interval();
        this.onQuestionComplete();
    }
}
