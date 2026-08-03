import { InstructionSequenceRunner } from "./instruction.js";
import { requestWakeLock } from "./utils.js";
import { releaseWakeLock } from "./utils.js";
import { unlockAudioOnGesture } from "./utils.js";
import { preventDoubleTapZoom } from "./utils.js";
import { WebRTCChannel } from "../webRTC.js";

export class StudentTestView extends EventTarget {
    chatSocket;
    assignmentId;
    domElements;
    student;

    currentPart = null;
    previousPart = null;
    currentPartIndex = null;
    currentQuestion = null;
    currentQuestionIndex = null;
    showingOutro = false;
    showingInstructions = false;
    isPracticing = false;
    repeatQuestionIndex = null;
    paused = false;

    constructor(test, chatSocket, assignmentId, domElements, student) {
        super();
        preventDoubleTapZoom();
        this.test = test;
        this.p2p = new WebRTCChannel();
        this.p2p.studentSetup(chatSocket, student);
        this.assignmentId = assignmentId;
        this.domElements = domElements;
        this.student = student;
        this.p2p.addEventListener("message", (e) => {
            this.onChatMessage(e.detail);
        });
        this.audioContext = unlockAudioOnGesture();
        this.failedAttempts = 0;
        this.cancelAudio = false;
    }

    questionTitle(practice = false) {
        if (practice) {
            return `${this.currentQuestionIndex + 1}/${this.currentPart.practice.length} (${this.currentPart.name}) - Instruktion`;
        } else {
            return `${this.currentQuestionIndex + 1}/${this.currentPart.questions.length} (${this.currentPart.name})`;
        }
    }

    send(data) {
        data.assignmentId = this.assignmentId;
        data.uuid = crypto.randomUUID();
        data.student = this.student;
        console.log("Chat: sending", data);
        this.p2p.send(data);
    }

    onChatMessage(data) {
        console.log("Chat: received", data);

        if (data.event === "test.cancelled") {
            this.onTestComplete(true);
        }

        if (data.event === "test.paused") {
            this.pauseTest();
        }

        if (data.event === "test.resume") {
            this.resumeTest();
        }
    }

    pauseTest() {
        this.paused = true;

        // Remember which timers were running so that resuming restores exactly
        // those (and no reminder sound fires while paused).
        this._pausedHadQuestionTimers =
            this.questionTimeoutId != null || this.questionReminderId != null;
        this._pausedHadPartTimeout = this.partTimeoutId != null;

        // Clear all timeouts so nothing (including reminder sounds) fires while
        // the test is paused.
        this.clearTimeout();
        this.clearReminder();
        this.clearPartTimeout();

        // Cover the student's interface with the pause overlay. It sits on top
        // of everything and intercepts all clicks/taps, so all buttons are
        // effectively invalidated while paused.
        this.domElements.showPauseOverlay();

        this.send({
            event: "test.paused",
            message: "Testen er sat på pause",
        });
    }

    resumeTest() {
        this.paused = false;

        // Uncover the interface so the student can interact with it again.
        this.domElements.hidePauseOverlay();

        // Re-initiate the question timeout and reminder sounds.
        if (this._pausedHadQuestionTimers && this.currentQuestion) {
            this.setupReminder();
        }

        // Re-initiate the part timeout.
        if (
            this._pausedHadPartTimeout &&
            this.currentPart &&
            typeof this.onPartTimeout === "function"
        ) {
            this.setupPartTimeout();
        }

        this.send({
            event: "test.resumed",
            message: "Testen er genoptaget",
        });
    }

    start() {
        requestWakeLock();
        this.setPart(this.test.getFirstUnansweredTestPartIndex(this.student));
        this.startIntro();

        this.send({
            event: "test.started",
            message: "Testen er startet",
        });
        this.domElements.setRepeatButtonListener(() => this.repeat());
    }

    startIntro() {
        this.domElements._setButtonListener(this.domElements.endIntroButton, () =>
            this.endIntro(),
        );
    }

    startTestPartOutro() {
        this.showingOutro = true;
        this.domElements.showTestPartOutro();
        this.domElements.hideTestContainer();

        this.domElements._setButtonListener(
            this.domElements.endTestPartOutroButton,
            () => this.endTestPartOutro(),
        );

        if (this.previousPart) {
            this.domElements.setTestPartOutroText(
                this.previousPart.name +
                    ' <span class="checkmark"><i class="ph-fill ph-check-fat"></i></span>',
            );
            this.domElements.showTestPartOutroImage();

            this.domElements.playSound(
                this.previousPart.completionSource,
                this.audioContext,
            );
        } else {
            this.domElements.hideTestPartOutroImage();
        }
    }

    startBreak() {
        this.domElements.showTestBreak();
        this.domElements.hideTestPartOutro();

        // Inden du går videre til den næste deltest kan du holde pause.
        // Tryk på grøn knap når du er klar.
        this.domElements.playSound("/static/audio/1t.9.wav", this.audioContext);
        this.domElements._setButtonListener(this.domElements.endBreakButton, () => {
            this.domElements.interruptSound();
            this.endBreak();
        });
    }

    sleep(ms) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (this.cancelAudio) reject(new Error("cancelled"));
                else resolve();
            }, ms);
        });
    }

    async startSoundCalibration() {
        this.domElements.setBodyBackground("#E5ECF2"); // Light blue
        this.cancelAudio = false;
        this.domElements.hideSoundCalibrationAnimation();
        this.domElements.hideElement(this.domElements.endSoundCalibrationButton);
        this.domElements.showSoundCalibration();

        this.domElements._setButtonListener(
            this.domElements.endSoundCalibrationButton,
            () => this.endSoundCalibration(),
        );
        this.domElements._setButtonListener(
            this.domElements.skipSoundCalibrationButton,
            () => {
                this.cancelAudio = true;
                this.domElements.interruptSound();
                this.endSoundCalibration();
            },
        );

        this.domElements._setButtonListener(
            this.domElements.soundCalibrationAnimation,
            async () => {
                const el = this.domElements.soundCalibrationAnimation;
                if (el._busyPromise) return;
                el._busyPromise = (async () => {
                    this.domElements.startSoundCalibrationAnimation();

                    // Jeg hedder Pilu
                    // Juster lyden, så du kan høre min stemme tydeligt.
                    await this.domElements.playSound(
                        "/static/audio/1t.3.wav",
                        this.audioContext,
                    );
                    this.domElements.stopSoundCalibrationAnimation();
                })();
                el._busyPromise.finally(() => {
                    el._busyPromise = null;
                });
            },
        );

        this.domElements.speakerIcon.classList.add("playing");

        // Testen starter om lidt.
        try {
            await this.domElements.playSound(
                "/static/audio/1t.1.wav",
                this.audioContext,
            );
            await this.sleep(750);

            // Først skal du justere lyden ved hjælp af iPadens lydknap.
            await this.domElements.playSound(
                "/static/audio/1t.2.wav",
                this.audioContext,
            );
            this.domElements.speakerIcon.classList.remove("playing");

            await this.sleep(750);
            this.domElements.showSoundCalibrationAnimation();
            await this.domElements.waitForClick(
                this.domElements.soundCalibrationAnimation,
            );

            await this.sleep(750);
            this.domElements.stopSoundCalibrationAnimation();

            // Tryk grøn når du er klar.
            this.domElements.speakerIcon.classList.add("playing");
            await this.domElements.playSound(
                "/static/audio/1t.4.wav",
                this.audioContext,
            );
            this.domElements.speakerIcon.classList.remove("playing");

            this.domElements.showElement(this.domElements.endSoundCalibrationButton);
        } catch (e) {
            if (e.message !== "cancelled") throw e;
            // cancelled — just exit silently
        }
    }

    async startSummary() {
        console.log("Test started, showing summary");
        this.cancelAudio = false;
        this.domElements.hideElement(this.domElements.endSummaryButton);
        this.domElements.showSummary(this.test.parts, this.student);

        this.domElements._setButtonListener(this.domElements.endSummaryButton, () =>
            this.endSummary(),
        );

        this.domElements._setButtonListener(this.domElements.skipSummaryButton, () => {
            this.cancelAudio = true;
            this.domElements.interruptSound();
            this.endSummary();
        });

        try {
            // Du kommer til at arbejde med forskellige opgaver.
            await this.domElements.playSound(
                "/static/audio/1t.5.wav",
                this.audioContext,
            );
            await this.sleep(750);

            // Du får at vide, hvergang en ny deltests skal starte.
            await this.domElements.playSound(
                "/static/audio/1t.6.wav",
                this.audioContext,
            );
            await this.sleep(750);

            // Tryk grøn når du er klar.
            await this.domElements.playSound(
                "/static/audio/1t.7.wav",
                this.audioContext,
            );

            this.domElements.showElement(this.domElements.endSummaryButton);
        } catch (e) {
            if (e.message !== "cancelled") throw e;
            // cancelled — just exit silently
        }
    }

    endSummary() {
        this.domElements.hideSummary();
        this.showFirstQuestion(this.canPractice());
    }

    endBreak() {
        this.domElements.hideTestBreak();
        this.showFirstQuestion(this.canPractice());
    }

    endIntro() {
        this.domElements.hideIntro();

        if (this.test.completedByStudent(this.student)) {
            this.setPart(this.test.parts.length - 1);
            this.onTestComplete();
        } else {
            this.startSoundCalibration();
        }
    }

    endTestPartOutro() {
        this.domElements.hideTestPartOutro();
        this.showingOutro = false;
        this.startBreak();
    }

    endSoundCalibration() {
        this.domElements.resetBodyBackground();
        this.domElements.hideSoundCalibration();
        if (this.test.parts.length > 1) {
            this.startSummary();
        } else {
            this.showFirstQuestion(this.canPractice());
        }
    }

    canPractice() {
        return this.currentPart.practice.length > 0;
    }

    updateNextButtonClass() {
        if (
            this.isPracticing &&
            this.currentPart.practice.length > 0 &&
            this.currentQuestionIndex === this.currentPart.practice.length - 1
        ) {
            // Sidste spørgsmål i øveopgave
            this.domElements.setNextButtonClass("start-part-btn"); // Blå knap
        } else {
            this.domElements.setNextButtonClass("next-btn"); // Grøn knap med pil
        }
    }

    showFirstQuestion(isPracticing = false) {
        this.isPracticing = isPracticing;
        console.log(
            "Showing first question",
            this.isPracticing ? "(practice)" : "(test)",
        );
        this.domElements.showTestContainer();
        this.domElements.hideTestPartOutro();

        const firstUnanswered = this.isPracticing
            ? 0
            : this.currentPart.getFirstUnansweredQuestionIndex(this.student);
        const result = this.showQuestion(this.isPracticing, firstUnanswered);
        if (!this.isPracticing && Number(this.currentPart.timeout) > 1) {
            this.setupPartTimeout();
        }
        return result;
    }

    async onTestComplete(cancelled = false) {
        console.log("Test complete");
        releaseWakeLock();
        this.domElements.hideInstructions();
        this.domElements.showQuestionChallenge();

        if (cancelled) {
            alert("Testen er afbrudt");
            this.student.progress = 100;
            this.send({
                event: "test.cancelled",
                message: "Testen er afbrudt",
            });
        } else {
            this.send({
                event: "test.complete",
                message: "Testen er afsluttet",
            });
        }

        this.dispatchEvent(
            new Event("test.complete", {
                test: this.test,
            }),
        );
        this.domElements.hideAll();

        if (this.test.parts.length > 1) {
            this.domElements.showSummary(this.test.parts, this.student, true);

            // Du er færdig med alle deltest. Tak.
            this.domElements.playSound("/static/audio/1t.10.wav", this.audioContext);
        } else {
            this.domElements.showTestExit();
            this.domElements.playSound(
                this.currentPart.completionSource,
                this.audioContext,
            );
        }
    }

    // ---- Parts ----

    setPart(index) {
        if (index >= this.test.parts.length) {
            // throw new Error("Cannot show part index " + index + ", only " + this.parts.length + " parts available.");
            return false;
        }
        this.currentPartIndex = index;
        this.previousPart = this.currentPart;
        this.currentPart = this.test.parts[index];
        return true;
    }

    onPartComplete() {
        this.clearPartTimeout();
        this.dispatchEvent(
            new Event("part.complete", {
                test: this.test,
                part: this.currentPart,
            }),
        );

        const canShow = this.setPart(this.currentPartIndex + 1);

        if (canShow) {
            console.log("Part complete, showing next part");
            this.startTestPartOutro();
        } else {
            console.log("Part complete, no more parts");
            this.onTestComplete();
        }
    }

    // ---- Questions ----

    setQuestion(isPracticing, questionIndex) {
        this.currentQuestionIndex = questionIndex;
        this.isPracticing = isPracticing;
        const questions = isPracticing
            ? this.currentPart.practice
            : this.currentPart.questions;
        if (questionIndex >= questions.length) {
            //throw new Error("Cannot show question index " + index + ", only " + questions.length + " questions available.")
            return false;
        }
        this.currentQuestion = questions[questionIndex];

        this.student.currentQuestionIndex = this.currentQuestionIndex;
        this.student.currentPartIndex = this.currentPartIndex;

        return true;
    }

    showNextQuestion() {
        const canShow = this.showQuestion(
            this.isPracticing,
            this.currentQuestionIndex + 1,
        );

        if (canShow) {
            this.domElements.fadeScreenOverlay();
        }
        return canShow;
    }

    setRepeatDestination(data) {
        this.repeatQuestionIndex = data;
    }

    repeat() {
        this.showQuestion(
            this.isPracticing,
            this.repeatQuestionIndex !== null
                ? this.repeatQuestionIndex
                : this.currentQuestionIndex,
        );
    }

    setStudentHeader() {
        if (
            this.currentQuestion.instruction_sequence &&
            this.currentQuestion.continueWhenInstructionIsComplete != false
        ) {
            this.domElements.setStudentHeader('<i class="ph ph-ear"></i>');
        } else if (this.isPracticing) {
            this.domElements.setStudentHeader('<i class="ph ph-pencil-line"></i>');
        } else {
            this.domElements.hideStudentHeader();
        }
    }

    runInstructions(onCompleted = () => {}) {
        console.log("---------------------------------------------");
        console.log(
            "Starting instruction sequence: ",
            this.currentQuestion.instruction_sequence,
        );
        this.showingInstructions = true;
        this.endedInstructions = false;
        this.send({ event: "instructions.started" });
        this.updateNextButtonClass();
        this.domElements.lockInput();
        this.domElements.toggleBodyClass("show-instructions", true);

        const instructionRunner = new InstructionSequenceRunner(
            this,
            this.currentQuestion.instruction_sequence.instructions,
            this.domElements,
            this.audioContext,
        );

        if (this.domElements.skipInstructionButton) {
            this.domElements.skipInstructionButton.addEventListener("click", () => {
                instructionRunner.skip();
            });
            this.domElements.skipAllInstructionsButton.addEventListener("click", () => {
                instructionRunner.skipToEnd();
            });
            this.domElements.skipInstructionButton.style.display = "block";
            this.domElements.skipAllInstructionsButton.style.display = "block";
        }

        this.domElements.fadeScreenOverlay();

        instructionRunner.run().then(() => {
            this.domElements.unlockInput();
            if (this.domElements.skipInstructionButton) {
                this.domElements.skipInstructionButton.style.display = "none";
                this.domElements.skipAllInstructionsButton.style.display = "none";
            }
            this.endedInstructions = true;
            this.showingInstructions = false;
            this.updateNextButtonClass();
            this.send({ event: "instructions.completed" });
            onCompleted();
            if (this.currentQuestion.advanceAutomatically) {
                this.showNextQuestion();
            }
            if (this.currentQuestion.continueWhenInstructionIsComplete) {
                this.domElements.enableNextButton();
            }
        });
    }

    clearTimeout() {
        if (this.questionTimeoutId) {
            clearTimeout(this.questionTimeoutId);
            this.questionTimeoutId = null;
        }
    }
    clearPartTimeout() {
        if (this.partTimeoutId) {
            clearTimeout(this.partTimeoutId);
            this.partTimeoutId = null;
        }
    }
    clearReminder() {
        if (this.questionReminderId) {
            clearTimeout(this.questionReminderId);
            this.questionReminderId = null;
        }
    }

    setupPartTimeout() {
        this.partTimeoutId = setTimeout(() => {
            this.onPartTimeout();
        }, this.currentPart.timeout);
    }

    setupReminder() {
        if (Number(this.currentQuestion.timeout) > 1) {
            this.clearTimeout();
            this.questionTimeoutId = setTimeout(() => {
                this.onQuestionComplete(this.currentQuestion, true);
            }, this.currentQuestion.timeout);
        }
        if (Number(this.currentQuestion.reminder) > 1) {
            this.clearReminder();
            this.questionReminderId = setTimeout(() => {
                console.log(
                    "Playing reminder sound",
                    this.currentQuestion.reminderSource,
                );
                this.domElements.playSound(
                    this.currentQuestion.reminderSource,
                    this.audioContext,
                    "drop",
                );
            }, this.currentQuestion.reminder);
        }
    }
}
