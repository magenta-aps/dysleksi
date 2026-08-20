/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { WebRTCChannel } from "../webRTC.js";

class MockConnection extends EventTarget {
    constructor() {
        super();
        this.open = false;
        this.send = vi.fn();
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
        this.id = "mock-peer-id";
    }
    on(event, cb) {
        this.addEventListener(event, (e) => cb(e.detail !== undefined ? e.detail : e));
    }
}

// Attach to global so the constructor in webRTC.js finds it
global.Peer = MockPeer;

describe("WebRTCChannel", () => {
    let channel;
    let mockPeerInstance;

    beforeEach(() => {
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

        channel = new WebRTCChannel();
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
        expect(channel.messageQueue).toEqual([]);
    });

    it('should send "student.joined" via chatSocket when peer opens', () => {
        const mockChatSocket = { send: vi.fn() };
        const mockStudent = { id: 123 };

        channel.studentSetup(mockChatSocket, mockStudent);

        // Simulate PeerJS 'open' event
        mockPeerInstance.dispatchEvent(
            new CustomEvent("open", { detail: "generated-id-456" }),
        );

        expect(mockChatSocket.send).toHaveBeenCalledWith(
            JSON.stringify({
                event: "student.joined",
                studentId: 123,
                webRTCId: "generated-id-456",
            }),
        );
    });

    it("should assign connection when a remote peer connects (Teacher -> Student)", () => {
        const mockConn = new MockConnection();
        channel.studentSetup({}, {});

        // Simulate incoming connection
        mockPeerInstance.dispatchEvent(
            new CustomEvent("connection", { detail: mockConn }),
        );

        expect(channel.conn).toBe(mockConn);
    });

    it("connect(id) should initiate a PeerJS connection", async () => {
        const mockConn = new MockConnection();
        mockPeerInstance.connect.mockReturnValue(mockConn);

        channel.connect("student-id");

        expect(mockPeerInstance.connect).toHaveBeenCalledWith("student-id");
        expect(channel.conn).toBe(mockConn);
    });

    it('should dispatch "message" event when data is received', () => {
        const mockConn = new MockConnection();
        const messageSpy = vi.fn();
        channel.addEventListener("message", messageSpy);

        // Manually trigger setup
        channel.conn = mockConn;
        channel._setupConnectionEvents();

        // Simulate incoming data
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

        channel.conn = mockConn;
        channel._setupConnectionEvents();

        mockConn.dispatchEvent(new Event("close"));

        expect(closeSpy).toHaveBeenCalled();
    });

    it("close() should destroy the peer", () => {
        channel.close();

        expect(mockPeerInstance.destroy).toHaveBeenCalled();
    });

    it("should send data immediately if connection is open", () => {
        const mockConn = new MockConnection();
        mockConn.open = true;
        channel.conn = mockConn;

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
        channel.conn = mockConn;

        const data1 = { event: "msg1" };
        const data2 = { event: "msg2" };

        // 1. Queue messages
        channel.send(data1);
        channel.send(data2);
        expect(channel.messageQueue.length).toBe(2);

        // 2. Setup events and trigger 'open'
        channel._setupConnectionEvents();
        mockConn.dispatchEvent(new Event("open"));

        // 3. Verify send was called for both and queue is empty
        expect(mockConn.send).toHaveBeenCalledWith(data1);
        expect(mockConn.send).toHaveBeenCalledWith(data2);
        expect(channel.messageQueue.length).toBe(0);
    });

    it('should dispatch an "open" event to listeners when connection is ready', () => {
        const mockConn = new MockConnection();
        const openSpy = vi.fn();
        channel.addEventListener("open", openSpy);

        channel.conn = mockConn;
        channel._setupConnectionEvents();
        mockConn.dispatchEvent(new Event("open"));

        expect(openSpy).toHaveBeenCalled();
    });
});
