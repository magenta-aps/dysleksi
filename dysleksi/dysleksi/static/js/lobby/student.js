import { getWebSocket } from "../ws.js";

const REDIRECT_DEBOUNCE_MS = 300;

export function initRedirectSocket(
    studentId,
    assignmentId,
    redirect_events = ["session.in_progress", "session.start"],
) {
    const chatSocket = getWebSocket();
    let pendingRedirect = null;
    let debounceTimer = null;

    const doRedirect = () => {
        window.location = pendingRedirect.roomUrl;
    };

    chatSocket.addEventListener("message", (e) => {
        const data = JSON.parse(e.data);
        if (redirect_events.includes(data.event)) {
            if (
                data.studentIds.includes(studentId) &&
                // When assignmentID is undefined, a student listens for any assignment
                // When it is set, the student only listens to a specific assignment
                (data.assignmentId == assignmentId || assignmentId === undefined)
            ) {
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
