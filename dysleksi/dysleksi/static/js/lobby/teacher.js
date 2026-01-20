import { getWebSocket } from "../ws.js";
import { getLobbySocket } from "./socket.js";

export function initTeacherLobby() {
    const lobbySocket = getLobbySocket();

    lobbySocket.onmessage = (e) => {
        const data = JSON.parse(e.data);

        if (data.event !== "lobby.joined") return;

        const chatId = data.room;
        const button = document.querySelector(
            `a[data-room="${chatId}"] .btn.disabled`
        );

        if (!button) return;

        button.classList.remove("disabled");

        button.addEventListener("click", (e) => {
            e.preventDefault();

            const chatSocket = getWebSocket(chatId);
            chatSocket.addEventListener("open", () => {
                chatSocket.send(JSON.stringify({
                    event: "session.start",
                    id: chatId,
                }));

                setTimeout(() => {
                    window.location = `/chat/${chatId}/`;
                }, 1);
            });
        });
    };
}
