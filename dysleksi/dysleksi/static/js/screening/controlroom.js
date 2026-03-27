import { Student } from "./model.js";
import { WebRTCChannel } from "../webRTC.js";
import { serverOnline } from "./utils.js";

export class EventTable {
    constructor(test, tableSelector = "table#events tbody") {
        this.test = test;
        this.eventsEl = document.querySelector(tableSelector);
        this.prevAnswer = null;
    }

    updateTable(data) {
        if (this.eventsEl === null) {
            return;
        }
        if (
            data.practice ||
            !["question.answered", "question.feedback"].includes(data.event)
        ) {
            return;
        }
        if (data.event === "question.answered") {
            this.prevAnswer = data;
        }

        const part = this.test.parts[data.partIndex];

        let rowEl;
        let partNameEl;
        let questionEl;
        let resultEl;
        let answerEl;
        let noteEl;

        if (data.event === "question.feedback") {
            // Add new row to table
            rowEl = document.createElement("tr");
            partNameEl = this.createTd("part-name");
            questionEl = this.createTd("question");
            resultEl = this.createTd("result");
            answerEl = this.createTd("answer");
            noteEl = this.createTd("note");
            rowEl.append(partNameEl, questionEl, resultEl, answerEl, noteEl);
            this.eventsEl.prepend(rowEl);
        } else {
            // Modify existing row (created when handling `question.feedback` event)
            try {
                rowEl = this.eventsEl.querySelector("tbody tr:first-of-type");
                partNameEl = rowEl.querySelector("td.part-name");
                questionEl = rowEl.querySelector("td.question");
                resultEl = rowEl.querySelector("td.result");
                answerEl = rowEl.querySelector("td.answer");
                noteEl = rowEl.querySelector("td.note");
            } catch {
                console.warn("no previous row found, doing nothing");
                return;
            }
        }

        // Update `part-name` cell
        partNameEl.textContent = part.name;

        // Update `question` cell
        this.updateQuestionEl(questionEl, part.questions[data.questionIndex]);

        // Update `result` cell (teacher's assessment)
        if (data.event === "question.feedback" && data.correct !== undefined) {
            const template = document.querySelector("template#edit-result");
            const clone = document.importNode(template.content, true);
            const button = clone.querySelector("button");
            this.updateResultButtonState(button, data.correct);
            const choices = clone.querySelectorAll("a.dropdown-item");
            for (const choice of choices) {
                choice.addEventListener("click", (evt) => {
                    this.handleResultButtonChange(evt);
                });
            }
            resultEl.append(clone);
        }

        // Update `answer` cell using data from previously received `question.answered` event
        if (this.prevAnswer !== null) {
            this.updateAnswerEl(answerEl, this.prevAnswer);
            this.prevAnswer = null;
        }

        // Update `note` cell
        const inputEl = this.getOrCreateEl(noteEl, "input");
        inputEl.type = "text";
        inputEl.classList.add("form-control");
        if (data.event === "question.feedback" && data.note !== undefined) {
            inputEl.value = data.note;
        }
    }

    updateQuestionEl(questionEl, question) {
        // Remove previous nodes in `questionEl`
        questionEl.replaceChildren();
        // Add number
        const numberEl = document.createElement("span");
        numberEl.textContent = `${question.index + 1}.`;
        questionEl.append(numberEl);
        // Add challenge
        const challengeEl = document.createElement("span");
        challengeEl.textContent = question.challengeText;
        challengeEl.classList.add("challenge");
        questionEl.append(challengeEl);
    }

    updateResultButtonState(button, state) {
        button.textContent =
            state === null ? "Sprunget over" : state ? "Korrekt" : "Forkert";
        button.classList.add(
            state === null ? "btn-secondary" : state ? "btn-success" : "btn-danger",
        );
    }

    handleResultButtonChange(evt) {
        evt.preventDefault();
        const anchor = evt.target.href.match(/#\w+/)[0];
        const state = anchor === "#skipped" ? null : anchor === "#correct";
        const button =
            evt.target.parentElement.parentElement.parentElement.querySelector(
                "button",
            );
        button.classList.remove("btn-success", "btn-danger", "btn-secondary");
        this.updateResultButtonState(button, state);
    }

    updateAnswerEl(answerEl, data) {
        if (data.recordingBase64) {
            answerEl.append(this.createAudioEl(data.recordingBase64));
        } else if (data.textAnswer) {
            answerEl.textContent = data.textAnswer;
        } else {
            answerEl.textContent = data.choiceId || "";
        }
    }

    createAudioEl(recordingBase64) {
        const audioEl = document.createElement("audio");
        audioEl.controls = true;
        audioEl.src = recordingBase64;
        return audioEl;
    }

    createTd(cls) {
        const td = document.createElement("td");
        td.classList.add(cls);
        return td;
    }

    getOrCreateEl(el, tag) {
        const oldEl = el.querySelector(tag);
        if (oldEl !== null) {
            return oldEl;
        } else {
            const newEl = document.createElement(tag);
            el.append(newEl);
            return newEl;
        }
    }
}

export class StudentCard {
    constructor(student, test) {
        this.student = student;
        this.testParts = test.parts;
        this.el = this._createMarkup();
        this.foldedArea = this.el.querySelector(".folded-area");
        this.progressFill = this.el.querySelector(".progress-fill");
        this.partsProgress = this.el.querySelector(".parts-progress");
        this.nameText = this.el.querySelector(".student-text");
        this.arrowIcon = this.el.querySelector(".foldout-arrow i");
        this.dotsContainer = this.el.querySelector(".dots-container");
        this.partLabel = this.el.querySelector(".part-label");
        this.partIndex = this.el.querySelector(".part-index");
        this.questionIndex = this.el.querySelector(".question-index");
        this.subTestLeftArrow = this.el.querySelector(".ph-caret-left");
        this.subTestRightArrow = this.el.querySelector(".ph-caret-right");

        this.currentViewPartIndex = 0;

        // Initial setup
        this.nameText.textContent = this.student.displayName;
        this._initEventListeners();
    }

    _initEventListeners() {
        // Toggle fold
        this.el.addEventListener("click", (e) => this.toggleFold(e));

        // Navigation Arrows
        this.subTestLeftArrow.addEventListener("click", (e) => {
            e.stopPropagation();
            this.changePart(-1);
        });
        this.subTestRightArrow.addEventListener("click", (e) => {
            e.stopPropagation();
            this.changePart(1);
        });
    }

    _createMarkup() {
        const template = document.getElementById("student-card-template");
        const clone = template.content.cloneNode(true);
        return clone.querySelector(".student-card");
    }

    toggleFold(e) {
        if (e.target.closest(".folded-area")) return;

        const isHidden = this.foldedArea.style.display === "none";
        this.foldedArea.style.display = isHidden ? "flex" : "none";

        this.el.classList.toggle("is-expanded", isHidden);

        this.arrowIcon.className = isHidden
            ? "ph-fill ph-caret-down"
            : "ph-fill ph-caret-up";
    }

    changePart(step) {
        const newIndex = this.currentViewPartIndex + step;
        this.currentViewPartIndex = newIndex;
        this.update();
    }

    _renderPartsProgress() {
        this.partsProgress.innerHTML = "";

        this.testParts.forEach((_, index) => {
            const segment = document.createElement("div");
            segment.classList.add("part-segment");

            // Logic for segment colors
            if (index < this.student.currentPartIndex) {
                segment.classList.add("completed");
            } else if (index === this.student.currentPartIndex) {
                segment.classList.add("current");
            } else {
                segment.classList.add("future");
            }

            this.partsProgress.appendChild(segment);
        });
    }

    update() {
        this._renderPartsProgress();
        const isCurrentPart =
            this.currentViewPartIndex === this.student.currentPartIndex;
        this.progressFill.style.width = `${this.student.progress}%`;

        this.subTestLeftArrow.classList.toggle(
            "disabled",
            this.currentViewPartIndex === 0,
        );

        this.subTestRightArrow.classList.toggle(
            "disabled",
            this.currentViewPartIndex === this.testParts.length - 1,
        );

        const part = this.testParts[this.currentViewPartIndex];
        this.partLabel.textContent = part.name;
        this.partIndex.textContent = `Deltest ${this.currentViewPartIndex + 1}/${this.testParts.length}`;
        if (isCurrentPart) {
            this.questionIndex.textContent = `Opgave ${this.student.currentQuestionIndex + 1}/${part.questions.length}`;
        } else {
            this.questionIndex.textContent = `Opgave -/${part.questions.length}`;
        }
        // Render Dots
        this.dotsContainer.innerHTML = "";
        const results = this.student.resultsByPart[this.currentViewPartIndex] || [];

        // Total dots = total questions in this part
        const totalQuestions = part.questions.length;

        for (let i = 0; i < totalQuestions; i++) {
            const dot = document.createElement("span");
            const isCurrentQuestion = i === this.student.currentQuestionIndex;
            dot.classList.add("dot");

            if (results[i] === true) {
                dot.classList.add("correct");
            } else if (results[i] === false) {
                dot.classList.add("wrong");
            } else if (isCurrentPart && isCurrentQuestion) {
                dot.classList.add("current");
            } else {
                dot.classList.add("default");
            }
            this.dotsContainer.appendChild(dot);
        }
    }
}

export class GroupTestContainer {
    constructor(test) {
        this.container = document.querySelector(".group-test-body");
        this.students = new Map();
        this.cards = new Map();
        this.test = test;
    }

    updateData(data) {
        if (!this.container) return;

        const studentData = data.student;
        let student = this.students.get(studentData.id);

        if (!student) {
            student = new Student(studentData);
            this.students.set(student.id, student);

            const card = new StudentCard(student, this.test);
            this.cards.set(student.id, card);
            this.container.appendChild(card.el);
        }

        student.progress = studentData.progress;
        student.currentPartIndex = studentData.currentPartIndex;
        student.currentQuestionIndex = studentData.currentQuestionIndex;
        student.resultsByPart = studentData.resultsByPart;

        this.cards.get(student.id).update();
    }
}

export class ActionButtons {
    constructor() {
        this.buttons = [
            ...document.querySelectorAll(
                "#correct, #wrong, #cancelled, #skipped, #next",
            ),
        ];
        this.active = null;
    }

    disableButtons() {
        this.buttons.forEach((el) => el.classList.toggle("disabled", true));
    }

    enableButtons() {
        this.buttons.forEach((el) => el.classList.toggle("disabled", false));
    }

    hideButtons() {
        this.buttons.forEach((el) => el.classList.toggle("d-none", true));
    }

    showButtons() {
        this.buttons.forEach((el) => el.classList.toggle("d-none", false));
    }

    disableNextButton() {
        this.nextButton().classList.toggle("disabled", true);
    }

    enableNextButton() {
        this.nextButton().classList.toggle("disabled", false);
    }

    setActive(buttonId) {
        this.active = buttonId;
        this.#updateButtonActiveState(buttonId);
        this.enableNextButton();
    }

    clearActive() {
        // Update state
        this.active = null;
        this.#updateButtonActiveState(null);
        this.disableNextButton();
    }

    getActive() {
        return this.active;
    }

    addClickListener(callback) {
        this.buttons.forEach((el) => {
            el.addEventListener("click", callback);
        });
    }

    buttonById(id) {
        return this.buttons.values().find((b) => b.id === id);
    }

    correctButton() {
        return this.buttonById("correct");
    }
    wrongButton() {
        return this.buttonById("wrong");
    }
    cancelButton() {
        return this.buttonById("cancelled");
    }
    skipButton() {
        return this.buttonById("skipped");
    }

    nextButton() {
        return this.buttonById("next");
    }

    #updateButtonActiveState(buttonId) {
        // Deactivate all relevant buttons
        for (const btn of [
            this.correctButton(),
            this.wrongButton(),
            this.skipButton(),
        ]) {
            btn.classList.toggle("active", false);
        }
        // Activate the specified button, if given
        if (buttonId !== null) {
            this.buttonById(buttonId).classList.toggle("active", true);
        }
    }
}

export class NoteField {
    constructor(noteSelector = "textarea#note") {
        this.noteEl = document.querySelector(noteSelector);
    }

    getNote() {
        return this.noteEl.value;
    }

    clearNote() {
        this.noteEl.value = "";
    }

    show() {
        this.noteEl.classList.toggle("d-none", false);
    }
}

export class QuestionView {
    containerElement;
    titleElement;
    contentElement;
    constructor(
        containerSelector = "#question-container",
        titleSelector = "#question-title",
        contentSelector = "#question-content",
        partNameSelector = null,
        partIndicatorSelector = null,
        questionIndicatorSelector = null,
    ) {
        this.containerElement = document.querySelector(containerSelector);
        this.titleElement = document.querySelector(titleSelector);
        this.contentElement = document.querySelector(contentSelector);
        this.partName = document.querySelector(partNameSelector);
        this.partIndicator = document.querySelector(partIndicatorSelector);
        this.questionIndicator = document.querySelector(questionIndicatorSelector);
    }

    show() {
        this.containerElement.classList.toggle("d-none", false);
    }

    showTitle(titleText) {
        this.titleElement.textContent = titleText;
    }

    showContent(contentText, contentImageUrl) {
        let img = document.querySelector("#challenge-image");
        if (contentImageUrl) {
            if (!img) {
                img = document.createElement("img");
                img.id = "challenge-image";
                this.contentElement.append(img);
            }
            img.src = contentImageUrl;
        } else {
            if (img) {
                img.remove();
            }
        }
        let txt = document.querySelector("#challenge-text");
        if (contentText) {
            if (!txt) {
                txt = document.createElement("p");
                txt.id = "challenge-text";
                this.contentElement.append(txt);
            }
            txt.textContent = contentText;
            if (contentText.length === 1) {
                txt.style.fontSize = "72px";
            } else {
                txt.style.fontSize = "40px";
            }
        } else {
            if (txt) {
                txt.remove();
            }
        }
    }

    updatePartName(name) {
        if (this.partName !== null) {
            this.partName.innerText = name;
        }
    }

    updatePartIndicator(text) {
        if (this.partIndicator !== null) {
            this.partIndicator.innerText = text;
        }
    }

    updateQuestionIndicator(text) {
        if (this.questionIndicator !== null) {
            this.questionIndicator.innerText = text;
        }
    }
}

export class ElapsedTimeView {
    domElement;

    constructor(selector) {
        this.domElement = document.querySelector(selector);
        this.running = false;
        this.t1 = null;
        this.interval = window.setInterval(() => {
            this.update();
        }, 1000);
    }

    start() {
        this.running = true;
        // On first call to `start`, set `t1` to current time
        if (this.t1 === null) {
            this.t1 = new Date();
        }
    }

    stop() {
        this.running = false;
    }

    update() {
        if (this.running && this.t1 !== null) {
            const delta = new Date(new Date() - this.t1);
            const hours = String(delta.getHours() - 1).padStart(2, "0");
            const minutes = String(delta.getMinutes()).padStart(2, "0");
            const seconds = String(delta.getSeconds()).padStart(2, "0");
            this.domElement.innerText = `${hours}:${minutes}:${seconds}`;
        }
    }
}

export class TeacherView {
    constructor(
        roomName,
        test,
        assignmentId,
        wsGetter,
        table,
        buttons,
        noteField,
        questionView,
        elapsedTimeView = null,
    ) {
        this.assignmentId = assignmentId;
        this.roomName = roomName;
        this.wsGetter = wsGetter;
        this.chatSocket = null;
        this.test = test;

        this.partIndex = null;
        this.questionIndex = null;
        this.currentPart = null;
        this.currentQuestion = null;
        this.currentIsPractice = null;

        this.table = table || new EventTable();
        this.groupTestContainer = new GroupTestContainer(test);
        this.buttons = buttons || new ActionButtons();
        this.noteField = noteField || new NoteField();
        this.questionView = questionView || new QuestionView();
        this.elapsedTimeView = elapsedTimeView;

        this.filterButtons = document.querySelectorAll(".group-test-header .btn");
        this.filterButtons = document.querySelectorAll(".group-test-header .btn");
        this.studentChannels = {};

        const savedQueue = localStorage.getItem(`msg_queue_${this.roomName}`);
        this.messageQueue = savedQueue ? JSON.parse(savedQueue) : [];

        this._initSocket();
        this._initButtonListeners();
        this._initFilterButtonSelection();
        this._startSyncInterval();
    }

    validatePartIndex(partIndex) {
        if (
            partIndex === null ||
            partIndex === undefined ||
            partIndex < 0 ||
            partIndex >= this.test.parts.length
        ) {
            throw new Error(`Invalid part index ${partIndex}`);
        }
    }
    setPartIndex(partIndex) {
        this.validatePartIndex(partIndex);
        this.partIndex = partIndex;
        this.currentPart = this.test.parts[partIndex];
        this.questionView.updatePartName(this.currentPart.name);
        this.questionView.updatePartIndicator(
            `Deltest ${this.partIndex + 1} af ${this.test.parts.length}`,
        );
    }

    validateQuestionIndex(questionIndex, practice) {
        if (
            questionIndex === null ||
            questionIndex === undefined ||
            questionIndex < 0
        ) {
            throw new Error(`Invalid question index ${questionIndex}`);
        } else if (
            !practice &&
            questionIndex >= this.test.parts[this.partIndex].questions.length
        ) {
            throw new Error(`Invalid question index ${questionIndex}`);
        } else if (
            practice &&
            questionIndex >= this.test.parts[this.partIndex].practice.length
        ) {
            throw new Error(`Invalid question index ${questionIndex}`);
        }
    }
    setQuestionIndex(questionIndex, practice) {
        this.validateQuestionIndex(questionIndex, practice);
        this.currentIsPractice = practice;
        this.questionIndex = questionIndex;

        let label;
        let total;
        let current;
        const counts = this.getPracticeQuestionCounts();
        const clamp = (number, min, max) => {
            return Math.max(min, Math.min(number, max));
        };

        if (practice) {
            this.currentQuestion = this.currentPart.practice[questionIndex];
            const instructionSequence = this.currentQuestion.instruction_sequence;
            if (instructionSequence !== null && instructionSequence !== undefined) {
                label = "Instruktion";
                total = counts.instructions;
                current = clamp(
                    this.questionIndex + counts.instructions - counts.nonInstructions,
                    1,
                    total,
                );
            } else {
                label = "Øveopgave";
                total = counts.nonInstructions;
                current = clamp(
                    this.questionIndex + counts.nonInstructions - counts.instructions,
                    1,
                    total,
                );
            }
        } else {
            this.currentQuestion = this.currentPart.questions[questionIndex];
            label = "Opgave";
            total = this.currentPart.questions.length;
            current = this.questionIndex + 1;
        }

        this.questionView.updateQuestionIndicator(`${label} ${current} af ${total}`);
        this.questionView.updatePartName(this.currentPart.name);
        this.questionView.updatePartIndicator(
            `Deltest ${this.partIndex + 1} af ${this.test.parts.length}`,
        );
    }

    getPracticeQuestionCounts() {
        let instructions = 0;
        let nonInstructions = 0;
        for (const practice of this.currentPart.practice) {
            const instructionSequence = practice.instruction_sequence;
            if (instructionSequence !== null && instructionSequence !== undefined) {
                instructions++;
            } else {
                nonInstructions++;
            }
        }
        return { instructions: instructions, nonInstructions: nonInstructions };
    }

    _initP2PSocket(p2p) {
        p2p.addEventListener("message", (e) => {
            const data = e.detail;

            if (
                ["question.answered", "question.displayed"].includes(data.event) &&
                this.test.testType === "individual"
            ) {
                this.setPartIndex(data.partIndex);
                this.setQuestionIndex(data.questionIndex, data.practice);
                if (data.event === "question.displayed") {
                    this.buttons.enableButtons();
                    if (
                        this.currentQuestion !== null &&
                        this.currentQuestion.type === "no_input_required"
                    ) {
                        this.buttons.disableNextButton();
                    }
                    this.showQuestion();
                }

                // Update "elapsed time"
                if (this.elapsedTimeView !== null && this.currentQuestion !== null) {
                    if (!data.practice) {
                        if (data.event === "question.displayed") {
                            this.elapsedTimeView.start();
                        }
                        if (data.event === "question.answered") {
                            this.elapsedTimeView.stop();
                        }
                    }
                }
            }

            if (
                ["test.started", "question.answered", "question.displayed"].includes(
                    data.event,
                ) &&
                this.test.testType === "group"
            ) {
                this.groupTestContainer.updateData(data);
            }

            if (
                ["question.answered", "question.feedback"].includes(data.event) &&
                this.test.testType === "individual"
            ) {
                this.table.updateTable(data);
            }

            this.messageQueue.push(data);
            this._persistQueue(); // Persistent save
        });
    }

    _initSocket() {
        this.chatSocket = this.wsGetter(this.roomName);
        this.chatSocket.addEventListener("message", (e) => {
            const data = JSON.parse(e.data);

            if (data.event === "student.joined") {
                console.log("Setting up webRTC channel for student", data.studentId);

                if (this.studentChannels[data.studentId]) {
                    console.log(
                        "Cleaning up old connection for student",
                        data.studentId,
                    );
                    this.studentChannels[data.studentId].peer.destroy();
                }

                const p2p = new WebRTCChannel();
                this.studentChannels[data.studentId] = p2p;
                this._initP2PSocket(p2p);

                p2p.peer.on("open", () => {
                    p2p.connect(data.webRTCId);
                });
            }
        });
    }

    _persistQueue() {
        localStorage.setItem(
            `msg_queue_${this.roomName}`,
            JSON.stringify(this.messageQueue),
        );
    }

    _startSyncInterval() {
        this._flushMessageQueue();
        setInterval(() => {
            this._flushMessageQueue();
        }, 5000);
    }

    async _flushMessageQueue() {
        if (this.chatSocket.readyState === WebSocket.CONNECTING) {
            console.log("Socket is currently connecting... waiting.");
            return;
        }

        if (
            this.chatSocket.readyState === WebSocket.CLOSED ||
            this.chatSocket.readyState === WebSocket.CLOSING
        ) {
            console.log("Socket closed. Attempting to reconnect...");
            this._initSocket();
            return;
        }

        const isOnline = await serverOnline();

        // Only attempt to send if the server is online and we have messages
        if (
            this.messageQueue.length > 0 &&
            isOnline &&
            this.chatSocket.readyState === WebSocket.OPEN
        ) {
            console.log(`Syncing ${this.messageQueue.length} messages to server...`);

            const queueToProcess = [...this.messageQueue];

            try {
                for (const msg of queueToProcess) {
                    this.chatSocket.send(JSON.stringify(msg));
                }
                this.messageQueue = [];
                this._persistQueue();
            } catch (err) {
                console.error("Sync failed, keeping messages in storage:", err);
            }
        }
    }

    _initButtonListeners() {
        this.buttons.addClickListener((e) => {
            const val = e.target.id;
            if (val === "cancelled") {
                if (confirm("Er du sikker på at du vil afbryde testen")) {
                    this.sendTestCancelled();
                    this.buttons.disableButtons();
                }
            } else {
                if (
                    this.currentQuestion !== null &&
                    this.currentQuestion.type === "no_input_required"
                ) {
                    if (val === "next") {
                        // Send feedback and go to next question
                        this.sendQuestionFeedback(this.buttons.getActive());
                        this.noteField.clearNote();
                        this.buttons.clearActive();
                        this.buttons.disableButtons();
                    } else {
                        // Delay sending feedback until teacher clicks 'Next' button
                        this.buttons.setActive(val);
                    }
                } else {
                    // Send feedback immediately
                    this.sendQuestionFeedback(val);
                    this.hideQuestion();
                    this.noteField.clearNote();
                    this.buttons.disableButtons();
                }
            }
        });
    }

    sendTestCancelled() {
        Object.values(this.studentChannels).forEach((channel) => {
            channel.send({
                uuid: crypto.randomUUID(),
                event: "test.cancelled",
                roomName: this.roomName,
                partIndex: this.partIndex,
                questionIndex: this.questionIndex,
                questionId: this.currentQuestion.id,
                partId: this.currentPart.id,
                assignmentId: this.assignmentId,
                note: this.noteField.getNote(),
            });
        });
    }

    sendQuestionFeedback(val) {
        // Map `val` as follows: true=correct, false=wrong, null=skipped
        const correct = val === "skipped" ? null : val === "correct";
        const data = {
            uuid: crypto.randomUUID(),
            event: "question.feedback",
            roomName: this.roomName,
            partIndex: this.partIndex,
            questionIndex: this.questionIndex,
            questionId: this.currentQuestion.id,
            partId: this.currentPart.id,
            assignmentId: this.assignmentId,
            correct: correct,
            note: this.noteField.getNote(),
            practice: this.currentIsPractice,
        };
        // Update student sessions
        Object.values(this.studentChannels).forEach((channel) => {
            channel.send(data);
        });
        // Update local UI
        if (this.table !== null) {
            this.table.updateTable(data);
        }
    }

    showQuestion() {
        this.questionView.showTitle(
            `${this.questionIndex + 1}/${this.currentPart.questions.length} (${this.currentPart.name})`,
        );
        this.questionView.showContent(
            this.currentQuestion.challengeText,
            this.currentQuestion.challengeImageUrl,
        );
    }

    hideQuestion() {
        this.questionView.showTitle("");
        this.questionView.showContent("");
    }

    _initFilterButtonSelection() {
        this.filterButtons.forEach((btn) => {
            btn.addEventListener("click", () => {
                this.filterButtons.forEach((b) => b.classList.remove("selected"));
                btn.classList.add("selected");
            });
        });
    }
}
