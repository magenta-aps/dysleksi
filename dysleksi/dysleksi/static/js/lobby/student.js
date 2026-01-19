import { getWebSocket } from "../ws.js";
import { getLobbySocket } from "./socket.js";

export function initStudentLobby(config) {
    const {
        individualRoomName,
        classRoomName,
        individualRoomUrl,
        classRoomUrl,
    } = config;

    const lobbySocket = getLobbySocket();

    lobbySocket.addEventListener("open", () => {
        lobbySocket.send(JSON.stringify({
            event: "lobby.joined",
            room: individualRoomName,
        }));

        lobbySocket.send(JSON.stringify({
            event: "lobby.joined",
            room: classRoomName,
        }));
    });

    const individualSocket = getWebSocket(individualRoomName);
    individualSocket.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.event === "session.start") {
            window.location = individualRoomUrl;
        }
    };

    const classSocket = getWebSocket(classRoomName);
    classSocket.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.event === "session.start") {
            window.location = classRoomUrl;
        }
    };
}
