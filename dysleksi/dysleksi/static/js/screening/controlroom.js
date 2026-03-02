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

export class GroupTestContainer {
    constructor() {
        this.container = document.querySelector(".group-test-body");
    }

    updateData(data) {
        if (this.container === null) {
            return;
        }

        const student = data.student;

        // Try to find existing card
        let el = this.container.querySelector(`[data-student-id='${student.id}']`);

        if (!el) {
            // Create new card
            el = document.createElement("div");
            el.classList.add("student-card");
            el.dataset.studentId = student.id;

            // --- Top row wrapper (name + progress) ---
            const topRow = document.createElement("div");
            topRow.classList.add("student-top-row");
            el.appendChild(topRow);

            // Progress bar inside top row
            const fill = document.createElement("div");
            fill.classList.add("progress-fill");
            topRow.appendChild(fill);

            // Student name text inside top row
            const text = document.createElement("span");
            text.classList.add("student-text");
            const lastInitial = student.lastName ? student.lastName[0].toUpperCase() : "";
            if (lastInitial.length > 0){
                text.textContent = `${student.firstName} ${lastInitial}.`;
            } else {
                text.textContent = `${student.firstName}`;
            }

            topRow.appendChild(text);

            // Folded area container (hidden initially)
            const folded = document.createElement("div");
            folded.classList.add("folded-area");
            el.appendChild(folded);

            // Show/hide folded area arrow
            const arrow = document.createElement("span");
            arrow.classList.add("foldout-arrow")
            arrow.innerHTML = `<i class="ph-fill ph-caret-up"></i>`

            topRow.appendChild(arrow);

            // Click handler to toggle fold
            el.addEventListener("click", (e) => {
                // Prevent toggling if clicking inside folded area
                if (e.target.classList.contains("folded-area")) return;

                const isHidden = folded.style.display === "none" || folded.style.display === "";
            
                // Show or hide folded area
                folded.style.display = isHidden ? "flex" : "none";
                if (isHidden){
                    arrow.innerHTML = `<i class="ph-fill ph-caret-down"></i>`
                } else {
                    arrow.innerHTML = `<i class="ph-fill ph-caret-up"></i>`
                }
            });

            this.container.appendChild(el);
        }

        // Update progress
        const fill = el.querySelector(".progress-fill");
        fill.style.width = `${student.progress}%`;

        // Handle correct/incorrect dots
        if ("correct" in data) {
            const folded = el.querySelector(".folded-area");

            const dot = document.createElement("span");
            dot.classList.add("dot");
            dot.style.backgroundColor = data.correct ? "green" : "red";

            folded.appendChild(dot);
        }
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
    constructor(containerSelector="#question-container", titleSelector = '#question-title', contentSelector = '#question-content') {
        this.containerElement = document.querySelector(containerSelector);
        this.titleElement = document.querySelector(titleSelector);
        this.contentElement = document.querySelector(contentSelector);
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
            txt.textContent = contentText || "";
        } else {
            if (txt) {
                txt.remove();
            }
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
        this.groupTestContainer = new GroupTestContainer();
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
        if (practice) {
            this.currentQuestion = this.currentPart.practice[questionIndex];
        } else {
            this.currentQuestion = this.currentPart.questions[questionIndex];
        }
    }

    _initSocket() {
        this.chatSocket.addEventListener("message", (e) => {
            const data = JSON.parse(e.data);

            if (["test.started", "question.answered"].includes(data.event)) {
                this.groupTestContainer.updateData(data)
            }

            if (["test.cancelled", "test.complete", "question.answered", "question.displayed"].includes(data.event)) {
                this.table.updateTable(data);
            }

            if (["question.answered", "question.displayed"].includes(data.event)) {
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
