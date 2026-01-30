import { getWebSocket } from "../ws.js";

function initRedirectSocket(roomName) {
    const chatSocket = getWebSocket(roomName);

    chatSocket.addEventListener("message", (e) => {
        const data = JSON.parse(e.data);

        if (["session.in_progress", "session.start"].includes(data.event)) {
            window.location = data.roomUrl;
        }
    });

    chatSocket.addEventListener("open", () => {
        chatSocket.send(JSON.stringify({
            uuid: crypto.randomUUID(),
            event: "student.ready",
            roomName: roomName
        }));    
    }, { once: true });
        
    return chatSocket;
}

export function initStudentLobby(config) {
    const {
        individualRoomName,
        classRoomName,
    } = config;

    initRedirectSocket(individualRoomName);
    initRedirectSocket(classRoomName);
}
