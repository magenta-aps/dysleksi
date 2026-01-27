import { getWebSocket } from "../ws.js";

export function initStudentLobby(config) {
    const {
        individualRoomName,
        classRoomName,
    } = config;

    const individualSocket = getWebSocket(individualRoomName);
    individualSocket.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.event === "session.in_progress" || data.event === "session.start") {
            window.location = data.roomUrl;
        }
    };

    const classSocket = getWebSocket(classRoomName);
    classSocket.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.event === "session.in_progress" || data.event === "session.start") {
            window.location = data.roomUrl;
        }
    };
}
