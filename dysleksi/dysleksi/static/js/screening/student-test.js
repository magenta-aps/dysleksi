export class StudentTestView extends EventTarget {

    chatSocket;
    roomName;
    assignmentId;
    domElements;

    currentPart = null;
    previousPart = null;
    currentPartIndex = null;
    currentQuestion = null;
    currentQuestionIndex = null;

    constructor(test, chatSocket, roomName, assignmentId, domElements) {
        super();
        this.test = test;
        this.chatSocket = chatSocket;
        this.roomName = roomName;
        this.assignmentId = assignmentId;
        this.domElements = domElements;
        this.chatSocket.addEventListener("message", (e) => {
            this.onChatMessage(JSON.parse(e.data));
        });
    }

    questionTitle() {
        return `${this.currentQuestionIndex + 1}/${this.currentPart.questions.length} (${this.currentPart.name})`;
    }

    send(data) {
        data.roomName = this.roomName;
        data.assignmentId = this.assignmentId;
        data.uuid = crypto.randomUUID();
        console.log("Chat: sending", data);
        this.chatSocket.send(JSON.stringify(data));
    }

    onChatMessage(data) {
        console.log("Chat: received", data);
    }

    start() {
        this.setPart(0)
        this.showIntro();
    }

    showIntro() {
        this.domElements.setStartSummaryButtonListener(() => this.startSummary());
    }

    showTestPartIntro() {
        this.domElements.showTestPartIntro()
        this.domElements.hideTestContainer()
        this.domElements.setStartTestPartButtonListener(
            () => {
                this.showFirstQuestion(this.canPractice())
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

        const buttonText = this.canPractice() ? "Start øveopgave" : "Start deltest";

        this.domElements.setEndSummaryButtonListener(() => this.endSummary(), buttonText);
    }

    endSummary() {
        console.log("Summary ended, showing first part");
        this.domElements.hideSummary();
        this.showFirstQuestion(this.canPractice())
    }

    canPractice() {
        return this.currentPart.practice.length > 0;
    }

    showFirstQuestion(isPracticing) {
        console.log("Showing first question", isPracticing ? "(practice)" : "(test)");
        this.domElements.showTestContainer()
        this.domElements.hideTestPartIntro()

        const result = this.showQuestion(isPracticing, 0);
        if (!isPracticing && Number(this.currentPart.timeout) > 1) {
            this.partTimeoutId = setTimeout(() => {
                this.onPartTimeout();
            }, this.currentPart.timeout);
        }
        return result;
    }

    async onTestComplete(cancelled = false) {
        console.log("Test complete");
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

    showPart(partIndex) {
        return this.setPart(partIndex);
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
        if (this.showPart(this.currentPartIndex + 1)) {
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
        console.log("Showing question " + questionIndex + " of " + questions.length, "(practicing=",isPracticing,")");
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

}
