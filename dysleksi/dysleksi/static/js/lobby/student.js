import { listenForRedirect } from "../redirect.js";

export function initRedirectSocket(studentId) {
    const lobbySocket = listenForRedirect(studentId);

    lobbySocket.addEventListener(
        "open",
        () => {
            lobbySocket.send(
                JSON.stringify({
                    uuid: crypto.randomUUID(),
                    event: "student.ready",
                    studentId: studentId,
                }),
            );
        },
        { once: true },
    );

    return lobbySocket;
}
