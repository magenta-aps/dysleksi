import { getLobbySocket, getAssignmentSocket } from "./ws.js";

export function listenForRedirect(
    studentId,
    assignmentId,
    redirect_events = ["session.in_progress", "session.start"],
) {
    let chatSocket = null;

    if (assignmentId === undefined) {
        chatSocket = getLobbySocket();
    } else {
        chatSocket = getAssignmentSocket(assignmentId);
    }

    chatSocket.addEventListener("message", (e) => {
        const data = JSON.parse(e.data);
        if (redirect_events.includes(data.event)) {
            if (
                data.studentIds.includes(studentId) &&
                // When assignmentID is undefined, a student listens for any assignment
                // When it is set, the student only listens to a specific assignment
                (data.assignmentId == assignmentId || assignmentId === undefined)
            ) {
                console.log("Redirecting", data);
                window.location = data.roomUrl;
            }
        }
    });
    return chatSocket;
}
