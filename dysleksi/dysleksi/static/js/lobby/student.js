import { getWebSocket } from "../ws.js";

const REDIRECT_DEBOUNCE_MS = 300;

function initRedirectSocket(studentId) {
    const chatSocket = getWebSocket();
    let pendingRedirect = null;
    let debounceTimer = null;

    const doRedirect = () => {
        window.location = pendingRedirect.roomUrl;
    };

    chatSocket.addEventListener("message", (e) => {
        const data = JSON.parse(e.data);
        if (["session.in_progress", "session.start"].includes(data.event)) {
            if (data.students.includes(studentId)) {
                if (!pendingRedirect || data.timestamp > pendingRedirect.timestamp) {
                    console.log("Candidate redirect", data);
                    pendingRedirect = {
                        timestamp: data.timestamp,
                        roomUrl: data.roomUrl,
                    };
                }

                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(doRedirect, REDIRECT_DEBOUNCE_MS);
            }
        }
    });

    chatSocket.addEventListener(
        "open",
        () => {
            chatSocket.send(
                JSON.stringify({
                    uuid: crypto.randomUUID(),
                    event: "student.ready",
                    studentId: studentId,
                }),
            );
        },
        { once: true },
    );

    return chatSocket;
}

export function initStudentLobby(studentId) {
    initRedirectSocket(studentId);
}
