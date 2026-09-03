import { getAssignmentSocket } from "./ws.js";

// Amount of milliseconds to wait before giving up on webRTC local communication.
// When webRTC does not respons within this amount of milliseconds, a websocket
// connection is opened instead (which does not work offline)
export const WEBRTC_DEADLINE_MS = 10000;

export class WebSocketChannel extends EventTarget {
    constructor(assignmentId, studentId, role) {
        super();
        this.assignmentId = assignmentId;
        this.studentId = studentId;
        this.role = role;
        this.counterpart = role === "student" ? "teacher" : "student";
        this.messageQueue = [];
        this.closed = false;
        this._bind();
    }

    _bind() {
        this.socket = getAssignmentSocket(this.assignmentId);

        this.socket.addEventListener("message", (e) => {
            if (this.closed) {
                return;
            }
            const data = JSON.parse(e.data);
            // Students are only interested in teacher messages with the correct ID
            // Teachers are only interested in student messages
            if (data.studentId !== this.studentId || data.from !== this.counterpart) {
                return;
            }
            this.dispatchEvent(new CustomEvent("message", { detail: data }));
        });

        if (this.socket.readyState === WebSocket.OPEN) {
            queueMicrotask(() => this._opened());
        } else {
            this.socket.addEventListener("open", () => this._opened(), { once: true });
        }
    }

    _opened() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            console.log("Sending queued message: ", message.event);
            this.send(message);
        }
        this.dispatchEvent(new Event("open"));
    }

    send(data) {
        if (this.closed) {
            return;
        }
        const message = { ...data, from: this.role, studentId: this.studentId };

        if (this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
            return;
        }

        console.log("Relay not ready, queuing message:", data.event);
        this.messageQueue.push(message);

        if (
            this.socket.readyState === WebSocket.CLOSED ||
            this.socket.readyState === WebSocket.CLOSING
        ) {
            // getWebSocket() drops closed sockets from its cache, so this hands
            // back a fresh one to flush the queue into once it opens.
            this._bind();
        }
    }

    close() {
        // The room socket is shared with every other channel in this assignment,
        // so closing it is not ours to do. Falling silent is enough.
        this.closed = true;
    }
}

export function announceWebRTCFailure(chatSocket, assignmentId, studentId) {
    chatSocket.send(
        JSON.stringify({
            uuid: crypto.randomUUID(),
            event: "webrtc.failed",
            assignmentId: assignmentId,
            studentId: studentId,
        }),
    );
}

export function fallbackOnWebRTCFailure(
    p2p,
    { chatSocket, assignmentId, studentId, onFallback },
) {
    const deadline = setTimeout(() => {
        console.log("WebRTC did not connect, falling back to the server relay");
        announceWebRTCFailure(chatSocket, assignmentId, studentId);

        const channel = new WebSocketChannel(assignmentId, studentId, "student");
        // Put unsent messages in the new queue
        channel.messageQueue = p2p.messageQueue || [];
        onFallback(channel);
    }, WEBRTC_DEADLINE_MS);

    p2p.addEventListener("open", () => clearTimeout(deadline), { once: true });
}
