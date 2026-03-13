import { InstructionSequenceRunner } from "./instruction.js";
import { requestWakeLock } from "./utils.js";
import { releaseWakeLock } from "./utils.js";
import { unlockAudioOnGesture } from './utils.js';
import { preventDoubleTapZoom} from './utils.js';

export class StudentTestView extends EventTarget {

    chatSocket;
    roomName;
    assignmentId;
    domElements;
    student;

    currentPart = null;
    previousPart = null;
    currentPartIndex = null;
    currentQuestion = null;
    currentQuestionIndex = null;
    showingIntro = false
;
    showingInstructions = false
;
    isPracticing = false
;
    repeatQuestionIndex = null
;

    constructor(test, chatSocket, roomName, assignmentId, domElements, student) {
        super();
        preventDoubleTapZoom();
        this.test = test;
        this.chatSocket = chatSocket;
        this.roomName = roomName;
        this.assignmentId = assignmentId;
        this.domElements = domElements;
        this.student = student
        this.chatSocket.addEventListener("message", (e) => {
            this.onChatMessage(JSON.parse(e.data));
        });
        this.audioContext = unlockAudioOnGesture();
    }

    questionTitle(practice = false) {
        if (practice) {
            return `${this.currentQuestionIndex + 1}/${this.currentPart.practice.length} (${this.currentPart.name}) - Instruktion`;
        } else {
            return `${this.currentQuestionIndex + 1}/${this.currentPart.questions.length} (${this.currentPart.name})`;
        }
    }

    send(data) {
        data.roomName = this.roomName;
        data.assignmentId = this.assignmentId;
        data.uuid = crypto.randomUUID();
        data.student = this.student;
        console.log("Chat: sending", data);
        this.chatSocket.send(JSON.stringify(data));
    }

    onChatMessage(data) {
        console.log("Chat: received", data);
    }

    start() {
        requestWakeLock()
        this.setPart(0)
        this.showIntro();

        this.send({
            event: "test.started",
            message: "Testen er startet",
        });
        this.domElements.setRepeatButtonListener(() => this.repeat());
    }

    showIntro() {
        this.domElements.setStartSummaryButtonListener(() => this.startSummary());
    }

    showTestPartIntro() {
        this.showingIntro = true;
        this.domElements.showTestPartIntro()
        this.domElements.hideTestContainer()
        this.domElements.setStartTestPartButtonListener(
            () => {
                this.showingIntro = false;
                this.showFirstQuestion(this.canPractice());
            }
        );
        if (this.previousPart) {
            this.domElements.setTestPartIntroText(
                this.previousPart.name + ' <span class="checkmark"><i class="ph-fill ph-check-fat"></i></span>'
            )
            this.domElements.showTestPartIntroImage()
        } else {
            this.domElements.hideTestPartIntroImage()
        }
    }

    startSummary() {
        console.log("Test started, showing summary");
        this.domElements.hideInstructions();
        this.domElements.showSummary(this.test.parts);
        this.domElements.hideIntro();
        this.domElements.setEndSummaryButtonListener(() => this.endSummary());
    }

    endSummary() {
        console.log("Summary ended, showing first part");
        this.domElements.hideSummary();
        this.showFirstQuestion(this.canPractice());
    }

    canPractice() {
        return this.currentPart.practice.length > 0;
    }

    updateNextButtonClass() {
        // console.log(
        //     "Updating next button class. " +
        //     "isPracticing:",this.isPracticing,
        //     ", currentQuestionIndex:",this.currentQuestionIndex,
        //     ", practice.length:",this.currentPart.practice.length,
        //     ", questions.length:",this.currentPart.questions.length
        // );
        if (this.isPracticing && this.currentPart.practice.length > 0) {

            if (this.currentQuestionIndex === this.currentPart.practice.length - 1) {
                // Sidste spørgsmål i øveopgave
                this.domElements.setNextButtonClass("start-part-btn");  // Blå knap
                return;
            }

            if (!this.currentQuestionIndex) {
                // Første punkt i deltest
                this.domElements.setNextButtonClass("start-btn"); // Rund knap
                return;
            }

            if (this.showingIntro) {
                // Viser introduktion
                this.domElements.setNextButtonClass("start-btn"); // Rund knap
                return;
            }

            if (
                this.currentPart.practice.slice(0, this.currentQuestionIndex+1).every(q => !!q.instruction_sequence) &&
                !this.currentPart.practice[this.currentQuestionIndex+1].instruction_sequence &&
                !this.showingInstructions
            ) {
                // Dette og alle foregående spørgsmål har en instruktionssekvens. Næste spørgsmål har ikke. Vi er ikke p.t. i gang med at vise instruktioner
                this.domElements.setNextButtonClass("start-btn"); // Rund knap
                return;
            }

        }
        this.domElements.setNextButtonClass("next-btn"); // Grøn knap
    }

    showFirstQuestion(isPracticing = false) {
        this.isPracticing = isPracticing;
        console.log("Showing first question", this.isPracticing ? "(practice)" : "(test)");
        this.domElements.showTestContainer();
        this.domElements.hideTestPartIntro();

        const result = this.showQuestion(this.isPracticing, 0);
        if (!this.isPracticing && Number(this.currentPart.timeout) > 1) {
            this.partTimeoutId = setTimeout(() => {
                this.onPartTimeout();
            }, this.currentPart.timeout);
        }
        return result;
    }

    async onTestComplete(cancelled = false) {
        console.log("Test complete");
        releaseWakeLock()
        this.domElements.hideInstructions();
        this.domElements.showQuestionChallenge();

        if (cancelled) {
            alert("Testen er afbrudt");
        } else {
            this.send({
                event: "test.complete",
                message: "Testen er afsluttet",
            });
        }

        this.dispatchEvent(new Event("test.complete", {
            test: this.test
        }));
        this.domElements.hideTestContainer()
        this.domElements.showTestExit()
    }

    // ---- Parts ----

    setPart(index) {
        if (index >= this.test.parts.length) {
            // throw new Error("Cannot show part index " + index + ", only " + this.parts.length + " parts available.");
            return false;
        }
        this.currentPartIndex = index;
        this.previousPart = this.currentPart
        this.currentPart = this.test.parts[index];
        return true;
    }

    onPartComplete() {
        if (this.partTimeoutId) {
            clearTimeout(this.partTimeoutId);
            this.partTimeoutId = null;
        }
        this.dispatchEvent(new Event("part.complete", {
            test: this.test,
            part: this.currentPart
        }));

        const canShow = this.setPart(this.currentPartIndex + 1)

        if (canShow) {
            console.log("Part complete, showing next part");
            this.showTestPartIntro()
        } else {
            console.log("Part complete, no more parts");
            this.onTestComplete();
        }
    }

    // ---- Questions ----

    setQuestion(isPracticing, questionIndex) {
        this.currentQuestionIndex = questionIndex;
        this.isPracticing = isPracticing;
        const questions = isPracticing ? this.currentPart.practice : this.currentPart.questions;
        if (questionIndex >= questions.length) {
            //throw new Error("Cannot show question index " + index + ", only " + questions.length + " questions available.")
            return false;
        }
        this.currentQuestion = questions[questionIndex];

        return true;
    }

    showNextQuestion() {

        const canShow =  this.showQuestion(
            this.isPracticing,
            this.currentQuestionIndex + 1
        );

        if (canShow) {
            this.domElements.fadeScreenOverlay()
        }
        return canShow
    }

    setRepeatDestination(data) {
        this.repeatQuestionIndex = data;
    }

    repeat() {
        this.showQuestion(
            this.isPracticing,
            this.repeatQuestionIndex !== null ? this.repeatQuestionIndex : this.currentQuestionIndex
        );
    }

    setStudentHeader() {
        if (this.currentQuestion.instruction_sequence) {
            this.domElements.setStudentHeader('<i class="ph ph-ear"></i>');
        } else if (this.isPracticing) {
            this.domElements.setStudentHeader('<i class="ph ph-pencil-line"></i>');
        } else {
            this.domElements.hideStudentHeader();
        }
    }

    runInstructions(group) {
        console.log("---------------------------------------------")
        console.log("Starting instruction sequence: ", this.currentQuestion.instruction_sequence);
        this.showingInstructions = true;
        this.updateNextButtonClass();
        this.domElements.lockInput();
        this.domElements.toggleBodyClass("show-instructions", true);

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
            this.updateNextButtonClass();
            if (group) {
                this.domElements.toggleQuestionDisplay("none");
            }
        });

    }

    setupNonPractice() {
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
                let currentSource = null;
                this.domElements.playSound(this.currentQuestion.reminderSource, currentSource, this.audioContext);
            }, this.currentQuestion.reminder);
        }
        this.domElements.toggleNextButton(false);
    }
}
