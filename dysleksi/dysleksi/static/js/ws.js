let sockets = {};

export function getWebSocket() {
    const chatId = "lobby";
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";

    // Reuse socket if exists and open/connecting
    const existingSocket = sockets[chatId];
    if (
        existingSocket &&
        (existingSocket.readyState === WebSocket.OPEN ||
            existingSocket.readyState === WebSocket.CONNECTING)
    ) {
        return existingSocket;
    }

    // Otherwise create a new one
    const newSocket = new WebSocket(
        `${protocol}://${window.location.host}/ws/chat/${chatId}/`,
    );
    sockets[chatId] = newSocket;

    // Remove from cache when closed
    newSocket.addEventListener("close", () => {
        delete sockets[chatId];
    });

    return newSocket;
}

export function resetSockets() {
    sockets = {};
}
