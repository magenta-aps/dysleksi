import { getWebSocket } from "../ws.js";

export function extractQuestions(testContents) {
    return testContents.parts.flatMap(part =>
        part.questions.map(q => ({
            partId: part.id,
            partName: part.name,
            questionId: q.id,
            questionType: q.question_type,
            challengeName: q.challenge_name,
            challengeImageUrl: q.challenge_image_url,
            challengeSoundUrl: q.challenge_sound_url,
            challengeText: q.challenge_text,
            choices: q.possible_answers.map(a => ({
                id: a.id,
                text: a.resource_text,
                isCorrect: a.is_correct
            }))
        }))
    );
}

export function startSession(roomName) {
    const chatSocket = getWebSocket(roomName);

    chatSocket.addEventListener("open", () => {
        chatSocket.send(JSON.stringify({
            uuid: crypto.randomUUID(),
            event: "session.start",
            roomUrl: window.location.href.replace(window.location.origin, "")
        }));
    }, { once: true });

    chatSocket.addEventListener("message", (e) => {
        const data = JSON.parse(e.data);

        if (data.event == "student.ready") {
            refreshSession(roomName);
        }
    });

    return chatSocket;
}

function refreshSession(roomName) {
    const chatSocket = getWebSocket(roomName);

    if (chatSocket.readyState === WebSocket.OPEN) {
        chatSocket.send(JSON.stringify({
            uuid: crypto.randomUUID(),
            event: "session.in_progress",
            roomUrl: window.location.href.replace(window.location.origin, "")
        }));
    } else {
        // queue the message until the socket opens
        chatSocket.addEventListener("open", () => sendSessionMessage(chatSocket), { once: true });
    }
}

export function shuffleArray(array) {
    const arr = [...array]; // do not mutate original
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
