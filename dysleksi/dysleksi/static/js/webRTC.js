export class WebRTCChannel extends EventTarget {
    constructor() {
        super();
        this.conn = null;
        this.messageQueue = []; // Store messages here if not connected

        const configElement = document.getElementById('webrtc-config');
        const config = JSON.parse(configElement.textContent);

        const currentHost = window.location.hostname

        // See https://peerjs.com/ for details
        this.peer = new Peer(null, {
            host: currentHost,
            port: config.port,
            path: '/webrtc',
            secure: true,
            key: 'peerjs'
        });

    }

    studentSetup(chatSocket, student) {
        this.peer.on('connection', (connection) => {
            this.conn = connection;
            this._setupConnectionEvents();
        });

        this.peer.on("open", (id) => {
            chatSocket.send(JSON.stringify({
                event: "student.joined",
                studentId: student.id,
                webRTCId: id
            }))
        });
    }

    async connect(id) {
        this.conn = this.peer.connect(id);
        this._setupConnectionEvents();
    }

    _setupConnectionEvents() {
        this.conn.on('open', () => {
            // Send all messages that were waiting
            while (this.messageQueue.length > 0) {
                const msg = this.messageQueue.shift();
                console.log("Sending queued message: ", msg.event)
                this.conn.send(msg);
            }

            this.dispatchEvent(new Event('open'));
        });

        this.conn.on('data', (data) => {
            this.dispatchEvent(new CustomEvent('message', { detail: data }));
        });
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