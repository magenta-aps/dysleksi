import { getAssignmentSocket, sendWhenOpen } from "./ws.js";

export class WebRTCPeer {
    /* Owns the connection to the signalling server. A teacher page needs one
       channel per student, and they all share this single peer. */

    constructor() {
        const configElement = document.getElementById("webrtc-config");
        const config = JSON.parse(configElement.textContent);

        const currentHost = window.location.hostname;

        // See https://peerjs.com/ for details
        this.peer = new Peer(null, {
            host: currentHost,
            path: "/webrtc",
            secure: true,
            key: config.key,
        });

        this.opened = new Promise((resolve) => this.peer.on("open", resolve));
    }

    connect(webRTCId) {
        const channel = new WebRTCChannel();
        this.opened.then(() => channel.attach(this.peer.connect(webRTCId)));
        return channel;
    }

    reconnect() {
        if (this.peer.disconnected && !this.peer.destroyed) {
            console.log("Rejoining the signalling server");
            this.peer.reconnect();
        }
    }

    studentSetup(student, assignmentId) {
        const announce = (id) =>
            sendWhenOpen(
                getAssignmentSocket(assignmentId),
                JSON.stringify({
                    event: "student.joined",
                    studentId: student.id,
                    webRTCId: id,
                    assignmentId: assignmentId,
                }),
            );

        const channel = new WebRTCChannel(() => {
            this.reconnect();
            this.opened.then(announce);
        });
        this.peer.on("connection", (connection) => channel.attach(connection));
        this.opened.then(announce);
        return channel;
    }

    close() {
        this.peer.destroy();
    }
}

export class WebRTCChannel extends EventTarget {
    constructor(reconnect) {
        super();
        this.conn = null;
        this.messageQueue = []; // Store messages here if not connected
        this.reconnect = reconnect;
    }

    attach(conn) {
        if (this.conn !== null) {
            // Close any existing (dead?) connections
            this.conn.close();
        }
        this.conn = conn;

        conn.on("open", () => {
            this.dispatchEvent(new Event("open"));

            // Send all messages that were waiting
            while (this.messageQueue.length > 0) {
                const msg = this.messageQueue.shift();
                console.log("Sending queued message: ", msg.event);
                conn.send(msg);
            }
        });

        conn.on("data", (data) => {
            this.dispatchEvent(new CustomEvent("message", { detail: data }));
        });

        // The window on the other end closed, reloaded, or hung up on us
        conn.on("close", () => {
            this.dispatchEvent(new Event("close"));
        });
    }

    close() {
        if (this.conn !== null) {
            this.conn.close();
        }
    }

    send(data) {
        if (this.conn && this.conn.open) {
            this.conn.send(data);
        } else {
            console.log("P2P not ready, queuing message:", data.event);
            this.messageQueue.push(data);
        }
    }
}
