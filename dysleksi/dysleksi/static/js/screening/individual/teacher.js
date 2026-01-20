import { getWebSocket } from "../../ws.js";

export function initTeacher(roomName, tests) {

    const chatSocket = getWebSocket(roomName);
    let testIndex;

    const updateTable = function (data, test) {
        const eventsEl = document.querySelector('table#events tbody');
        const eventEl = document.createElement('tr');

        const typeEl = document.createElement('td');
        const questionEl = document.createElement('td');
        const answerEl = document.createElement('td');
        const durationEl = document.createElement('td');

        eventEl.append(typeEl);
        eventEl.append(questionEl);
        eventEl.append(answerEl);
        eventEl.append(durationEl);

        typeEl.innerHTML = data.event;
        questionEl.innerHTML = test.question;
        answerEl.innerHTML = '';

        if ((data.event === 'test.answered') && (test.type === 'audio-recording')) {
            const playerEl = document.createElement("audio");
            playerEl.controls = true;
            playerEl.src = data.recordingBase64;
            answerEl.append(playerEl);
        } else {
            answerEl.innerHTML = data.choice || '-';
        }

        if (data.event === 'test.answered') {
            durationEl.innerHTML = data.answeredAt;
        } else {
            durationEl.innerHTML = data.displayedAt;
        }

        eventsEl.prepend(eventEl);
    };

    const updateButtons = function (attr, val) {
        const actionEls = document.querySelectorAll('button');
        actionEls.forEach(function (el) {
            el.classList.toggle(attr, val);
        });
    }

    chatSocket.onmessage = function (e) {
        console.log('chat: received', e.data);

        const data = JSON.parse(e.data);
        if (data.event.match(/test.(answered|displayed)/)) {
            const test = tests[data.index];
            testIndex = data.index;
            updateTable(data, test);

            // Allow teacher to mark a multiple-choice question correct, wrong or skipped
            // once the student has given an answer.
            if ((data.event === 'test.answered') && (test.type === 'multiple-choice')) {
                updateButtons('disabled', false);
            }

            // Allow teacher to mark an audio recording question correct, wrong or skipped
            // when the question has been displayed to the student.
            if ((data.event === 'test.displayed') && (test.type === 'audio-recording')) {
                updateButtons('disabled', false);
            }
        }
    };


    const actionEls = document.querySelectorAll('button');
    actionEls.forEach(function (el) {
        el.addEventListener('click', function (e) {
            const val = e.target.id;
            if ((testIndex >= 0) && (testIndex < tests.length)) {
                chatSocket.send(
                    JSON.stringify(
                        {
                            'event': 'test.' + val,
                            'id': roomName,
                            'index': testIndex,
                        }
                    )
                )
                updateButtons('disabled', true);
            } else {
                console.error('invalid test index', testIndex);
            }
        });
    });


}
