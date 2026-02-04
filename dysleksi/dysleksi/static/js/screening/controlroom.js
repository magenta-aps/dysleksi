import { extractQuestions } from "./utils.js"

export class EventTable {
    constructor(tableSelector = 'table#events tbody') {
        this.eventsEl = document.querySelector(tableSelector);
    }

    updateTable(data, test) {
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

export class TeacherView {
    constructor(roomName, testContents, assignmentId, wsGetter, table, buttons, noteField) {
        this.assignmentId = assignmentId;
        this.roomName = roomName;
        this.chatSocket = wsGetter(roomName);
        this.tests = extractQuestions(testContents);
        this.questionIndex = null;

        this.table = table || new EventTable();
        this.buttons = buttons || new ActionButtons();
        this.noteField = noteField || new NoteField();

        this._initSocket();
        this._initButtonListeners();
    }

    _initSocket() {
        this.chatSocket.addEventListener("message", (e) => {
            const data = JSON.parse(e.data);

            if (data.event.match(/question.(answered|displayed)/)) {
                const question = this.tests[data.questionIndex];
                this.questionIndex = data.questionIndex;
                this.question = question;
                this.table.updateTable(data, question);
                if (data.event === 'question.displayed') {
                    this.buttons.enableButtons();
                }
            }
        });
    }

    _initButtonListeners() {
        this.buttons.addClickListener((e) => {
            const val = e.target.id;
            const correct = (val === "skipped") ? null : (val === "correct");
            if ((this.questionIndex >= 0) && (this.questionIndex < this.tests.length)) {
                this.chatSocket.send(
                    JSON.stringify({
                        uuid: crypto.randomUUID(),
                        event: 'question.feedback',
                        roomName: this.roomName,
                        questionIndex: this.questionIndex,
                        questionId: this.question.questionId,
                        partId: this.question.partId,
                        assignmentId: this.assignmentId,
                        correct: correct, // true=correct, false=wrong, null=skipped
                        note: this.noteField.getNote(),
                    })
                );
                this.buttons.disableButtons();
                this.noteField.clearNote();
            } else {
                console.error('invalid test index', this.questionIndex);
            }
        });
    }
}
