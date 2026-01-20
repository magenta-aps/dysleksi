export function getWebSocket(chatId) {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";

    return new WebSocket(
        `${protocol}://${window.location.host}/ws/chat/${chatId}/`
    );
}
