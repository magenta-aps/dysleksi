import { getWebSocket } from "../../ws.js";

export function initTeacher(roomName) {
    const chatSocket = getWebSocket(roomName);
    let testIndex;

    const updateTable = function (data) {
        const eventsEl = document.querySelector('table#events tbody');
        const eventEl = document.createElement('tr');

        const typeEl = document.createElement('td');
        const messageEl = document.createElement('td');
        const answerEl = document.createElement('td');
        const timeEl = document.createElement('td');

        eventEl.append(typeEl, messageEl, answerEl, timeEl);

        typeEl.innerHTML = data.event;
        messageEl.innerHTML = data.message || '-';
        answerEl.innerHTML = data.choice || '-';
        if (data.event === 'test.answered') {
            timeEl.innerHTML = data.duration ? `${data.duration} sekunder` : '-';
        } else {
            timeEl.innerHTML = data.displayedAt ? data.displayedAt.toFixed(1) : '-';
        }

        eventsEl.prepend(eventEl);
    };

    const updateButtons = function (attr, val) {
        const actionEls = document.querySelectorAll('button');
        actionEls.forEach(el => el.classList.toggle(attr, val));
    };

    chatSocket.addEventListener("message", (e) => {
        const data = JSON.parse(e.data);
        if (data.event && data.event.startsWith('test.')) {
            if (data.index !== undefined) testIndex = data.index;
            updateTable(data);

            if (data.event === 'test.answered') updateButtons('disabled', false);
        }
    });
}
