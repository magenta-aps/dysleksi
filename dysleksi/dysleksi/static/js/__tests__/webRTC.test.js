/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { WebRTCPeer, WebRTCChannel } from "../webRTC.js";
import { getAssignmentSocket } from "../ws.js";

vi.mock(import("../ws.js"), async (importOriginal) => ({
    ...(await importOriginal()),
    getAssignmentSocket: vi.fn(),
}));

class MockConnection extends EventTarget {
    constructor() {
        super();
        this.open = false;
        this.send = vi.fn();
        this.close = vi.fn();
    }
    on(event, cb) {
        this.addEventListener(event, (e) => cb(e.detail !== undefined ? e.detail : e));
    }
}

class MockPeer extends EventTarget {
    constructor() {
        super();
        this.connect = vi.fn();
        this.destroy = vi.fn();
        this.reconnect = vi.fn();
        this.disconnected = false;
        this.destroyed = false;
        this.id = "mock-peer-id";
    }
    on(event, cb) {
        this.addEventListener(event, (e) => cb(e.detail !== undefined ? e.detail : e));
    }
}

// Attach to global so the constructor in webRTC.js finds it
global.Peer = MockPeer;

describe("WebRTCPeer", () => {
    let peer;
    let mockPeerInstance;
    let mockSocket;

    const open = async (id = "generated-id-456") => {
        mockPeerInstance.dispatchEvent(new CustomEvent("open", { detail: id }));
        await peer.opened;
    };

    const joinMessage = JSON.stringify({
        event: "student.joined",
        studentId: 123,
        webRTCId: "generated-id-456",
        assignmentId: 7,
    });

    beforeEach(() => {
        mockSocket = { send: vi.fn(), readyState: WebSocket.OPEN };
        getAssignmentSocket.mockReturnValue(mockSocket);

        // Setup the config element required by the constructor
        document.body.innerHTML = `
            <script id="webrtc-config" type="application/json">
                {"port": 9000}
            </script>
        `;

        // Reset the Peer mock implementation to capture the instance
        vi.spyOn(global, "Peer").mockImplementation(function () {
            mockPeerInstance = new MockPeer();
            return mockPeerInstance;
        });

        peer = new WebRTCPeer();
    });

    it("should initialize with correct PeerJS configuration", () => {
        expect(global.Peer).toHaveBeenCalledWith(
            null,
            expect.objectContaining({
                host: window.location.hostname,
                path: "/webrtc",
                secure: true,
            }),
        );
    });

    it('should send "student.joined" via chatSocket when peer opens', async () => {
        peer.studentSetup({ id: 123 }, 7);
        await open();

        expect(mockSocket.send).toHaveBeenCalledWith(joinMessage);
    });

    it("should announce itself again when the channel is reconnected", async () => {
        const channel = peer.studentSetup({ id: 123 }, 7);
        await open();
        mockSocket.send.mockClear();

        channel.reconnect();
        await peer.opened;

        expect(mockSocket.send).toHaveBeenCalledWith(joinMessage);
    });

    it("should reconnect when disconnected", () => {
        mockPeerInstance.disconnected = true;

        peer.reconnect();

        expect(mockPeerInstance.reconnect).toHaveBeenCalled();
    });

    it("should not reconnect when the channel is destroyed", () => {
        peer.reconnect();

        mockPeerInstance.disconnected = true;
        mockPeerInstance.destroyed = true;
        peer.reconnect();

        expect(mockPeerInstance.reconnect).not.toHaveBeenCalled();
    });

    it("should assign connection when a remote peer connects (Teacher -> Student)", () => {
        const mockConn = new MockConnection();
        const channel = peer.studentSetup({}, 7);

        // Simulate incoming connection
        mockPeerInstance.dispatchEvent(
            new CustomEvent("connection", { detail: mockConn }),
        );

        expect(channel.conn).toBe(mockConn);
    });

    it("connect(id) should initiate a PeerJS connection once the peer is open", async () => {
        const mockConn = new MockConnection();
        mockPeerInstance.connect.mockReturnValue(mockConn);

        const channel = peer.connect("student-id");
        expect(channel.conn).toBeNull();

        await open();

        expect(mockPeerInstance.connect).toHaveBeenCalledWith("student-id");
        expect(channel.conn).toBe(mockConn);
    });

    it("shares a single peer between all the channels a teacher opens", async () => {
        mockPeerInstance.connect.mockImplementation(() => new MockConnection());

        const channels = [1, 2, 3].map((id) => peer.connect(`student-${id}`));
        await open();

        expect(global.Peer).toHaveBeenCalledTimes(1);
        expect(mockPeerInstance.connect).toHaveBeenCalledTimes(3);
        expect(new Set(channels.map((channel) => channel.conn)).size).toBe(3);
    });

    it("close() should destroy the peer", () => {
        peer.close();

        expect(mockPeerInstance.destroy).toHaveBeenCalled();
    });
});

describe("WebRTCChannel", () => {
    let channel;

    beforeEach(() => {
        channel = new WebRTCChannel();
    });

    it('should dispatch "message" event when data is received', () => {
        const mockConn = new MockConnection();
        const messageSpy = vi.fn();
        channel.addEventListener("message", messageSpy);
        channel.attach(mockConn);

        const testData = { event: "draw", x: 10 };
        mockConn.dispatchEvent(new CustomEvent("data", { detail: testData }));

        expect(messageSpy).toHaveBeenCalled();
        const eventReceived = messageSpy.mock.calls[0][0];
        expect(eventReceived.detail).toEqual(testData);
    });

    it('should dispatch "close" event when the other end hangs up', () => {
        const mockConn = new MockConnection();
        const closeSpy = vi.fn();
        channel.addEventListener("close", closeSpy);
        channel.attach(mockConn);

        mockConn.dispatchEvent(new Event("close"));

        expect(closeSpy).toHaveBeenCalled();
    });

    it("close() should close the connection but leave the peer alone", () => {
        const mockConn = new MockConnection();
        channel.attach(mockConn);

        channel.close();

        expect(mockConn.close).toHaveBeenCalled();
    });

    it("close() should do nothing when the connection was never established", () => {
        expect(() => channel.close()).not.toThrow();
    });

    it("should send data immediately if connection is open", () => {
        const mockConn = new MockConnection();
        mockConn.open = true;
        channel.attach(mockConn);

        const data = { event: "test-event" };
        channel.send(data);

        expect(mockConn.send).toHaveBeenCalledWith(data);
    });

    it("should queue messages if connection is not open", () => {
        const data = { event: "queued-event" };
        channel.send(data);

        expect(channel.messageQueue).toContain(data);
        expect(channel.conn).toBeNull();
    });

    it("should flush the message queue when the connection opens", () => {
        const mockConn = new MockConnection();
        const openSpy = vi.fn();
        channel.addEventListener("open", openSpy);

        const data1 = { event: "msg1" };
        const data2 = { event: "msg2" };
        channel.send(data1);
        channel.send(data2);
        expect(channel.messageQueue.length).toBe(2);

        channel.attach(mockConn);
        mockConn.dispatchEvent(new Event("open"));

        expect(mockConn.send).toHaveBeenCalledWith(data1);
        expect(mockConn.send).toHaveBeenCalledWith(data2);
        expect(channel.messageQueue.length).toBe(0);
        expect(openSpy).toHaveBeenCalled();
    });

    it("should hang up on the connection a new one replaces", () => {
        const oldConn = new MockConnection();
        const newConn = new MockConnection();

        channel.attach(oldConn);
        channel.attach(newConn);

        expect(oldConn.close).toHaveBeenCalled();
        expect(channel.conn).toBe(newConn);
    });
});
