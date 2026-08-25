let sockets = {};

// path = "chat" forwards and stores messages on the server
// path = "relay" only forwards messages. Nothing is stored.
export function getWebSocket(chatId = "lobby", path = "chat") {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const key = `${path}/${chatId}`;

    // Reuse socket if exists and open/connecting
    const existingSocket = sockets[key];
    if (
        existingSocket &&
        (existingSocket.readyState === WebSocket.OPEN ||
            existingSocket.readyState === WebSocket.CONNECTING)
    ) {
        return existingSocket;
    }

    // Otherwise create a new one
    const newSocket = new WebSocket(
        `${protocol}://${window.location.host}/ws/${path}/${chatId}/`,
    );
    sockets[key] = newSocket;

    // Remove from cache when closed
    newSocket.addEventListener("close", () => {
        delete sockets[key];
    });

    return newSocket;
}

export function resetSockets() {
    sockets = {};
}
