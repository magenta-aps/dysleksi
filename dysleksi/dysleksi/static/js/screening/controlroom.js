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

        if (data.event === 'test.answered') {
            if (data.recordingBase64) {
                const audioEl = document.createElement('audio');
                audioEl.controls = true;
                audioEl.src = data.recordingBase64;
                answerEl.append(audioEl);
            } else if (data.textAnswer){
                answerEl.textContent = data.textAnswer;
            } else {
                answerEl.textContent = data.choice || "";
            }
        } else {
            answerEl.textContent = '-';
        }

        durationEl.textContent = data.event === 'test.answered' ? data.answeredAt : data.displayedAt;

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

export class TeacherView {
    constructor(roomName, testContents, wsGetter, table, buttons) {
        this.roomName = roomName;
        this.chatSocket = wsGetter(roomName);
        this.tests = extractQuestions(testContents);
        this.testIndex = null;

        this.table = table || new EventTable();
        this.buttons = buttons || new ActionButtons();

        this._initSocket();
        this._initButtonListeners();
    }

    _initSocket() {
        this.chatSocket.addEventListener("message", (e) => {
            console.log('chat: received', e.data);
            const data = JSON.parse(e.data);

            if (data.event.match(/test.(answered|displayed)/)) {
                const test = this.tests[data.questionIndex];;
                this.testIndex = data.questionIndex;

                this.table.updateTable(data, test);

                if (data.event === 'test.displayed') {
                    this.buttons.enableButtons();
                }
            }
        });
    }

    _initButtonListeners() {
        this.buttons.addClickListener((e) => {
            const val = e.target.id;
            if ((this.testIndex >= 0) && (this.testIndex < this.tests.length)) {
                this.chatSocket.send(
                    JSON.stringify({
                        uuid: crypto.randomUUID(),
                        event: 'test.' + val,
                        id: this.roomName,
                        questionIndex: this.testIndex,
                    })
                );
                this.buttons.disableButtons();
            } else {
                console.error('invalid test index', this.testIndex);
            }
        });
    }
}
