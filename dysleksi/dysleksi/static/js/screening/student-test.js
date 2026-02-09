export class StudentTestView extends EventTarget {

    chatSocket;
    roomName;
    assignmentId;
    domElements;

    currentPart = null;
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
        this.startSummary();
    }

    next() {
        this.onQuestionComplete();
    }

    startSummary() {
        console.log("Test started, showing summary");
        this.domElements.hideInstructions();
        this.domElements.showQuestionTitle();
        this.domElements.showQuestionChallenge();
        this.domElements.showSummary(this.test.summaryText, this.test.summary);
        this.domElements.setSummaryButtonListener(() => this.endSummary());
    }

    endSummary() {
        console.log("Summary ended, showing first part");
        this.domElements.hideSummary();
        this.showPart(0);
    }

    async onTestComplete(cancelled = false) {
        console.log("Test complete");
        this.domElements.hideInstructions();
        this.domElements.showQuestionTitle();
        this.domElements.showQuestionChallenge();

        if (cancelled) {
            alert("Testen er afbrudt");
        } else {
            alert("Testen er færdig!");
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
        this.currentPart = this.test.parts[index];
        return true;
    }

    showPart(partIndex) {
        return this.setPart(partIndex);
    }

    onPartComplete() {
        this.dispatchEvent(new Event("part.complete", {
            test: this.test,
            part: this.currentPart
        }));
        if (this.showPart(this.currentPartIndex + 1)) {
            console.log("Part complete, showing next part");
            // next part is being shown
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

}
