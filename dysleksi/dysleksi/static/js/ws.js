let sockets = {};

// Sockets only forward messages. Storing them is what `MessageStorageView` is for.
function getWebSocket(chatId, path) {
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

export function getAssignmentSocket(assignmentId) {
    return getWebSocket(`assignment_${assignmentId}`, "relay");
}
export function getLobbySocket() {
    return getWebSocket("lobby", "relay");
}

export function sendWhenOpen(socket, message) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(message);
    } else {
        socket.addEventListener("open", () => socket.send(message), { once: true });
    }
}

export function resetSockets() {
    sockets = {};
}
