import { getWebSocket } from "../ws.js";

function initRedirectSocket(studentId) {
    const chatSocket = getWebSocket();

    chatSocket.addEventListener("message", (e) => {
        const data = JSON.parse(e.data);

        if (["session.in_progress", "session.start"].includes(data.event)) {
            if (data.students.includes(studentId)) {
                window.location = data.roomUrl;
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

export function initStudentLobby(studentId, hasOpenAssignments) {
    if (hasOpenAssignments) {
        initRedirectSocket(studentId);
    } else {
        console.log("No open assignments for student - not listening for redirects");
    }
}
