export class EventTable {
    constructor(tableSelector = 'table#events tbody') {
        this.eventsEl = document.querySelector(tableSelector);
    }

    updateTable(data) {
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

export class ActionButtons {
    constructor(buttonSelector = 'button') {
        this.buttons = document.querySelectorAll(buttonSelector);
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
        this.buttons = buttons || new ActionButtons();
        this.noteField = noteField || new NoteField();
        this.questionView = questionView || new QuestionView();

        this._initSocket();
        this._initButtonListeners();
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

    validateQuestionIndex(questionIndex) {
        if (questionIndex === null || questionIndex === undefined || questionIndex < 0 || questionIndex >= this.test.parts[this.partIndex].questions.length) {
            throw new Error(`Invalid question index ${questionIndex}`)
        }
    }
    setQuestionIndex(questionIndex) {
        this.validateQuestionIndex(questionIndex);
        this.questionIndex = questionIndex;
        this.currentQuestion = this.currentPart.questions[questionIndex];
    }

    _initSocket() {
        this.chatSocket.addEventListener("message", (e) => {
            const data = JSON.parse(e.data);

            if (["test.cancelled", "test.complete", "question.answered", "question.displayed"].includes(data.event)) {
                this.table.updateTable(data);
            }

            if (["question.answered", "question.displayed"].includes(data.event)) {
                this.setPartIndex(data.partIndex);
                this.setQuestionIndex(data.questionIndex);
                if (data.event === 'question.displayed') {
                    this.buttons.enableButtons();
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
                    this.chatSocket.send(JSON.stringify({
                        uuid: crypto.randomUUID(),
                        event: 'test.cancelled',
                        roomName: this.roomName,
                        partIndex: this.partIndex,
                        questionIndex: this.questionIndex,
                        questionId: this.currentQuestion.id,
                        partId: this.currentPart.id,
                        assignmentId: this.assignmentId,
                        note: this.noteField.getNote(),
                    }));
                    this.buttons.disableButtons();
                }
            } else {
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
                        correct: correct, // true=correct, false=wrong, null=skipped
                        note: this.noteField.getNote(),
                    })
                );
                this.buttons.disableButtons();
                this.noteField.clearNote();
                this.hideQuestion();
            }
        });
    }

    showQuestion() {
        this.questionView.showTitle(`${this.questionIndex + 1}/${this.currentPart.questions.length} (${this.currentPart.name})`);
        this.questionView.showContent(this.currentQuestion.challengeText, this.currentQuestion.challengeImageUrl);
    }

    hideQuestion() {
        this.questionView.showTitle('');
        this.questionView.showContent('');
    }
}
