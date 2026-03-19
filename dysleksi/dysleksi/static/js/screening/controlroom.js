import { Student } from "./model.js";

export class EventTable {
    constructor(tableSelector = 'table#events tbody') {
        this.eventsEl = document.querySelector(tableSelector);
    }

    updateTable(data) {
        if (this.eventsEl === null) {
            return;
        }

        const eventEl = document.createElement('tr');

        const typeEl = document.createElement('td');
        const questionEl = document.createElement('td');
        const answerEl = document.createElement('td');
        const durationEl = document.createElement('td');

        eventEl.append(typeEl, questionEl, answerEl, durationEl);

        typeEl.textContent = data.event;
        questionEl.textContent = data.questionTitle;

        if (data.event === 'question.answered') {
            if (data.recordingBase64) {
                const audioEl = document.createElement('audio');
                audioEl.controls = true;
                audioEl.src = data.recordingBase64;
                answerEl.append(audioEl);
            } else if (data.textAnswer){
                answerEl.textContent = data.textAnswer;
            } else {
                answerEl.textContent = data.choiceId || "";
            }
        } else {
            answerEl.textContent = '-';
        }

        durationEl.textContent = data.event === 'question.answered' ? data.answeredAt : data.displayedAt;

        this.eventsEl.prepend(eventEl);
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
        this.subTestLeftArrow = this.el.querySelector(".ph-caret-left")
        this.subTestRightArrow = this.el.querySelector(".ph-caret-right")

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
        const template = document.getElementById('student-card-template');
        const clone = template.content.cloneNode(true);
        return clone.querySelector('.student-card');
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
        this.partsProgress.innerHTML = '';
        
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
        const isCurrentPart = (this.currentViewPartIndex === this.student.currentPartIndex);
        this.progressFill.style.width = `${this.student.progress}%`;

        this.subTestLeftArrow.classList.toggle('disabled', this.currentViewPartIndex === 0);
            
        this.subTestRightArrow.classList.toggle('disabled',
            this.currentViewPartIndex === this.testParts.length - 1
        );

        const part = this.testParts[this.currentViewPartIndex];
        this.partLabel.textContent = part.name;
        this.partIndex.textContent = `Deltest ${this.currentViewPartIndex+1}/${this.testParts.length}`
        if (isCurrentPart) {
            this.questionIndex.textContent = `Opgave ${this.student.currentQuestionIndex+1}/${part.questions.length}`
        } else {
            this.questionIndex.textContent = `Opgave -/${part.questions.length}`

        }
        // Render Dots
        this.dotsContainer.innerHTML = '';
        const results = this.student.resultsByPart[this.currentViewPartIndex] || [];
        
        // Total dots = total questions in this part
        const totalQuestions = part.questions.length;

        for (let i = 0; i < totalQuestions; i++) {
            const dot = document.createElement("span");
            const isCurrentQuestion = (i === this.student.currentQuestionIndex);
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
        this.test = test
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
        student.resultsByPart = studentData.resultsByPart

        this.cards.get(student.id).update();
    }
}


export class ActionButtons {
    constructor(buttonSelector = 'button') {
        this.buttons = [...document.querySelectorAll('#correct, #wrong, #cancelled, #skipped, #next')];
        this.active = null;
    }

    disableButtons() {
        this.buttons.forEach(el => el.classList.toggle('disabled', true));
    }

    enableButtons() {
        this.buttons.forEach(el => el.classList.toggle('disabled', false));
    }

    hideButtons() {
        this.buttons.forEach(el => el.classList.toggle('d-none', true));
    }

    showButtons() {
        this.buttons.forEach(el => el.classList.toggle('d-none', false));
    }

    disableNextButton() {
        this.nextButton().classList.toggle('disabled', true);
    }

    enableNextButton() {
        this.nextButton().classList.toggle('disabled', false);
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
        this.buttons.forEach(el => {
            el.addEventListener('click', callback);
        });
    }

    buttonById(id) {
        return this.buttons.values().find(b => b.id === id);
    }

    correctButton() {
        return this.buttonById('correct');
    }
    wrongButton() {
        return this.buttonById('wrong');
    }
    cancelButton() {
        return this.buttonById('cancelled');
    }
    skipButton() {
        return this.buttonById('skipped');
    }

    nextButton() {
        return this.buttonById('next');
    }

    #updateButtonActiveState(buttonId) {
        // Deactivate all relevant buttons
        for (const btn of [this.correctButton(), this.wrongButton(), this.skipButton()]) {
            btn.classList.toggle('active', false);
        }
        // Activate the specified button, if given
        if (buttonId !== null) {
            this.buttonById(buttonId).classList.toggle('active', true);
        }
    }
}

export class NoteField {
    constructor(noteSelector = 'textarea#note') {
        this.noteEl = document.querySelector(noteSelector);
    }

    getNote() {
        return this.noteEl.value;
    }

    clearNote() {
        this.noteEl.value = '';
    }

    show() {
        this.noteEl.classList.toggle('d-none', false);
    }
}

export class QuestionView {
    containerElement;
    titleElement;
    contentElement;
    constructor(
        containerSelector="#question-container",
        titleSelector = '#question-title',
        contentSelector = '#question-content',
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
        this.containerElement.classList.toggle('d-none', false);
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

export class TeacherView {
    constructor(roomName, test, assignmentId, wsGetter, table, buttons, noteField, questionView) {
        this.assignmentId = assignmentId;
        this.roomName = roomName;
        this.chatSocket = wsGetter(roomName);
        this.test = test;

        this.partIndex = null;
        this.questionIndex = null;
        this.currentPart = null;
        this.currentQuestion = null;

        this.table = table || new EventTable();
        this.groupTestContainer = new GroupTestContainer(test);
        this.buttons = buttons || new ActionButtons();
        this.noteField = noteField || new NoteField();
        this.questionView = questionView || new QuestionView();
        this.filterButtons = document.querySelectorAll('.group-test-header .btn');

        this._initSocket();
        this._initButtonListeners();
        this._initFilterButtonSelection();
    }

    validatePartIndex(partIndex) {
        if (partIndex === null || partIndex === undefined || partIndex < 0 || partIndex >= this.test.parts.length) {
            throw new Error(`Invalid part index ${partIndex}`);
        }
    }
    setPartIndex(partIndex) {
        this.validatePartIndex(partIndex);
        this.partIndex = partIndex;
        this.currentPart = this.test.parts[partIndex];
        this.questionView.updatePartName(this.currentPart.name);
        this.questionView.updatePartIndicator(`Deltest ${this.partIndex + 1} af ${this.test.parts.length}`);
    }

    validateQuestionIndex(questionIndex, practice) {
        if (questionIndex === null || questionIndex === undefined || questionIndex < 0) {
            throw new Error(`Invalid question index ${questionIndex}`)
        } else if (!practice && questionIndex >= this.test.parts[this.partIndex].questions.length) {
            throw new Error(`Invalid question index ${questionIndex}`)
        } else if (practice && questionIndex >= this.test.parts[this.partIndex].practice.length) {
            throw new Error(`Invalid question index ${questionIndex}`)
        }
    }
    setQuestionIndex(questionIndex, practice) {
        this.validateQuestionIndex(questionIndex, practice);
        this.questionIndex = questionIndex;

        let label;
        let total;
        let current;
        const counts = this.getPracticeQuestionCounts();
        const clamp = (number, min, max) => {
            return Math.max(min, Math.min(number, max));
        }

        if (practice) {
            this.currentQuestion = this.currentPart.practice[questionIndex];
            const instructionSequence = this.currentQuestion.instruction_sequence;
            if (instructionSequence !== null && instructionSequence !== undefined) {
                label = "Instruktion";
                total = counts.instructions;
                current = clamp(
                    this.questionIndex + counts.instructions - counts.nonInstructions, 1, total
                );
            } else {
                label = "Øveopgave";
                total = counts.nonInstructions;
                current = clamp(
                    this.questionIndex + counts.nonInstructions - counts.instructions, 1, total
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
        this.questionView.updatePartIndicator(`Deltest ${this.partIndex + 1} af ${this.test.parts.length}`);
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

    _initSocket() {
        this.chatSocket.addEventListener("message", (e) => {
            const data = JSON.parse(e.data);

            if (["test.started", "question.answered", "question.displayed"].includes(data.event) && this.test.testType === 'group') {
                this.groupTestContainer.updateData(data)
            }

            if (["test.cancelled", "test.complete", "question.answered", "question.displayed"].includes(data.event) && this.test.testType === 'individual') {
                this.table.updateTable(data);
            }

            if (["question.answered", "question.displayed"].includes(data.event) && this.test.testType === 'individual' ) {
                this.setPartIndex(data.partIndex);
                this.setQuestionIndex(data.questionIndex, data.practice);
                if (data.event === 'question.displayed') {
                    this.buttons.enableButtons();
                    if ((this.currentQuestion !== null) && (this.currentQuestion.type === "no_input_required")) {
                        this.buttons.disableNextButton();
                    }
                    this.showQuestion();
                }
            }
        });
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
                if ((this.currentQuestion !== null) && (this.currentQuestion.type === "no_input_required")) {
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
        this.chatSocket.send(
            JSON.stringify({
                uuid: crypto.randomUUID(),
                event: 'test.cancelled',
                roomName: this.roomName,
                partIndex: this.partIndex,
                questionIndex: this.questionIndex,
                questionId: this.currentQuestion.id,
                partId: this.currentPart.id,
                assignmentId: this.assignmentId,
                note: this.noteField.getNote(),
            })
        );
    }

    sendQuestionFeedback(val) {
        // Map `val` as follows: true=correct, false=wrong, null=skipped
        const correct = (val === "skipped") ? null : (val === "correct");
        this.chatSocket.send(
            JSON.stringify({
                uuid: crypto.randomUUID(),
                event: 'question.feedback',
                roomName: this.roomName,
                partIndex: this.partIndex,
                questionIndex: this.questionIndex,
                questionId: this.currentQuestion.id,
                partId: this.currentPart.id,
                assignmentId: this.assignmentId,
                correct: correct,
                note: this.noteField.getNote(),
            })
        );
    }

    showQuestion() {
        this.questionView.showTitle(`${this.questionIndex + 1}/${this.currentPart.questions.length} (${this.currentPart.name})`);
        this.questionView.showContent(this.currentQuestion.challengeText, this.currentQuestion.challengeImageUrl);
    }

    hideQuestion() {
        this.questionView.showTitle('');
        this.questionView.showContent('');
    }

    _initFilterButtonSelection() {
        this.filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.filterButtons.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
        });
    }


}
