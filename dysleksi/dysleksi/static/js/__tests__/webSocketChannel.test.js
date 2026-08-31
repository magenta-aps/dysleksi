/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
    WEBRTC_DEADLINE_MS,
    WebSocketChannel,
    announceWebRTCFailure,
    fallbackOnWebRTCFailure,
} from "../webSocketChannel.js";
import { resetSockets } from "../ws.js";

class MockSocket extends EventTarget {
    constructor(url) {
        super();
        this.url = url;
        this.readyState = WebSocket.OPEN;
        this.send = vi.fn();
    }

    receive(payload) {
        this.dispatchEvent(
            new MessageEvent("message", { data: JSON.stringify(payload) }),
        );
    }
}

describe("WebSocketChannel", () => {
    let sockets;

    beforeEach(() => {
        sockets = [];
        vi.stubGlobal(
            "WebSocket",
            class extends MockSocket {
                constructor(url) {
                    super(url);
                    sockets.push(this);
                }
                static OPEN = 1;
                static CLOSED = 3;
                static CLOSING = 2;
                static CONNECTING = 0;
            },
        );
    });

    afterEach(() => {
        resetSockets();
        vi.unstubAllGlobals();
    });

    it("marks messages with role and studentId", () => {
        const channel = new WebSocketChannel(42, 7, "student");

        channel.send({ event: "question.answered" });

        expect(JSON.parse(sockets[0].send.mock.calls[0][0])).toEqual({
            event: "question.answered",
            from: "student",
            studentId: 7,
        });
    });

    it("delivers the teachers messages to the student", () => {
        const channel = new WebSocketChannel(42, 7, "student");
        const received = vi.fn();
        channel.addEventListener("message", (e) => received(e.detail));

        sockets[0].receive({ event: "test.paused", from: "teacher", studentId: 7 });

        expect(received).toHaveBeenCalledWith(
            expect.objectContaining({ event: "test.paused" }),
        );
    });

    it("ignores the echo of its own messages", () => {
        const channel = new WebSocketChannel(42, 7, "student");
        const received = vi.fn();
        channel.addEventListener("message", received);

        // The room broadcasts to everyone in it, including the sender
        sockets[0].receive({
            event: "question.answered",
            from: "student",
            studentId: 7,
        });

        expect(received).not.toHaveBeenCalled();
    });

    it("ignores traffic belonging to another student in a group test", () => {
        const channel = new WebSocketChannel(42, 7, "teacher");
        const received = vi.fn();
        channel.addEventListener("message", received);

        sockets[0].receive({
            event: "question.answered",
            from: "student",
            studentId: 9,
        });

        expect(received).not.toHaveBeenCalled();
    });

    it("queues messages until the room socket opens, then flushes them", async () => {
        vi.stubGlobal(
            "WebSocket",
            class extends MockSocket {
                constructor(url) {
                    super(url);
                    this.readyState = WebSocket.CONNECTING;
                    sockets.push(this);
                }
                static OPEN = 1;
                static CLOSED = 3;
                static CLOSING = 2;
                static CONNECTING = 0;
            },
        );

        const channel = new WebSocketChannel(42, 7, "student");
        channel.send({ event: "test.started" });

        expect(sockets[0].send).not.toHaveBeenCalled();

        sockets[0].readyState = WebSocket.OPEN;
        sockets[0].dispatchEvent(new Event("open"));

        expect(JSON.parse(sockets[0].send.mock.calls[0][0])).toMatchObject({
            event: "test.started",
        });
        expect(channel.messageQueue).toEqual([]);
    });

    it("reconnects to the room when the socket has dropped", () => {
        const channel = new WebSocketChannel(42, 7, "student");
        sockets[0].readyState = WebSocket.CLOSED;

        channel.send({ event: "question.answered" });

        // A replacement socket was opened, and the message waits for it
        expect(sockets).toHaveLength(2);
        expect(channel.socket).toBe(sockets[1]);
        expect(channel.messageQueue).toHaveLength(1);
    });

    it("falls silent when closed, without closing the shared room socket", () => {
        const channel = new WebSocketChannel(42, 7, "student");
        const received = vi.fn();
        channel.addEventListener("message", received);

        channel.close();
        channel.send({ event: "question.answered" });
        sockets[0].receive({ event: "test.paused", from: "teacher", studentId: 7 });

        expect(sockets[0].send).not.toHaveBeenCalled();
        expect(received).not.toHaveBeenCalled();
    });
});

describe("fallbackOnWebRTCFailure", () => {
    let p2p;
    let chatSocket;
    let onFallback;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal(
            "WebSocket",
            class extends MockSocket {
                static OPEN = 1;
                static CLOSED = 3;
                static CLOSING = 2;
                static CONNECTING = 0;
            },
        );

        p2p = new EventTarget();
        p2p.messageQueue = [];
        chatSocket = { send: vi.fn() };
        onFallback = vi.fn();
    });

    afterEach(() => {
        vi.useRealTimers();
        resetSockets();
        vi.unstubAllGlobals();
    });

    const arm = () =>
        fallbackOnWebRTCFailure(p2p, {
            chatSocket: chatSocket,
            assignmentId: 42,
            studentId: 7,
            onFallback: onFallback,
        });

    it("does nothing while WebRTC still has time to connect", () => {
        arm();

        vi.advanceTimersByTime(WEBRTC_DEADLINE_MS - 1);

        expect(onFallback).not.toHaveBeenCalled();
    });

    it("hands over a relayed channel once the deadline passes", () => {
        arm();

        vi.advanceTimersByTime(WEBRTC_DEADLINE_MS);

        expect(onFallback).toHaveBeenCalledTimes(1);
        expect(onFallback.mock.calls[0][0]).toBeInstanceOf(WebSocketChannel);
    });

    it("tells the teacher, which is the only way it learns to follow along", () => {
        arm();

        vi.advanceTimersByTime(WEBRTC_DEADLINE_MS);

        expect(JSON.parse(chatSocket.send.mock.calls[0][0])).toMatchObject({
            event: "webrtc.failed",
            assignmentId: 42,
            studentId: 7,
        });
    });

    it("carries messages queued during the attempt over to the relay", () => {
        p2p.messageQueue.push({ event: "test.started" });
        arm();

        vi.advanceTimersByTime(WEBRTC_DEADLINE_MS);

        expect(onFallback.mock.calls[0][0].messageQueue).toEqual([
            { event: "test.started" },
        ]);
    });

    it("stands down once WebRTC connects", () => {
        arm();

        p2p.dispatchEvent(new Event("open"));
        vi.advanceTimersByTime(WEBRTC_DEADLINE_MS * 2);

        expect(onFallback).not.toHaveBeenCalled();
        expect(chatSocket.send).not.toHaveBeenCalled();
    });
});

describe("announceWebRTCFailure", () => {
    it("addresses the announcement to the student's assignment", () => {
        const chatSocket = { send: vi.fn() };

        announceWebRTCFailure(chatSocket, 42, 7);

        const sent = JSON.parse(chatSocket.send.mock.calls[0][0]);
        expect(sent.event).toBe("webrtc.failed");
        expect(sent.assignmentId).toBe(42);
        expect(sent.studentId).toBe(7);
        expect(sent.uuid).toBeTruthy();
    });
});
