import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initStudentLobby } from "../../lobby/student.js";
import * as wsModule from "../../ws.js";
import { withAnyUUID } from "../utils.js"


// Mock getWebSocket
vi.mock("../ws.js", () => ({
  getWebSocket: vi.fn(),
}));

describe("initStudentLobby / initRedirectSocket", () => {
  let sockets;
  let originalLocation;

  beforeEach(() => {
    sockets = {};

    // Mock window.location so assignment works
    originalLocation = global.window?.location;
    global.window = {
      location: "",
    };

    // Mock getWebSocket
    vi.spyOn(wsModule, "getWebSocket").mockImplementation((assignment) => {
      const listeners = {};

      const socket = {
        send: vi.fn(),
        addEventListener: vi.fn((event, cb, options) => {
          listeners[event] = { cb, options };
        }),
        __trigger(event, payload) {
          listeners[event]?.cb(payload);
        },
      };

      sockets[assignment] = socket;
      return socket;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.window.location = originalLocation;
  });

  it("creates redirect sockets for both individual and class rooms", () => {
    initStudentLobby({
      individualRoomName: "individual-room",
      classRoomName: "class-room",
    });

    expect(wsModule.getWebSocket).toHaveBeenCalledTimes(2);
    expect(wsModule.getWebSocket).toHaveBeenCalledWith("individual-room");
    expect(wsModule.getWebSocket).toHaveBeenCalledWith("class-room");
  });

  it("sends student.ready once when socket opens", () => {
    initStudentLobby({
      individualRoomName: "room-1",
      classRoomName: "room-2",
    });

    const socket = sockets["room-1"];

    socket.__trigger("open");

    expect(socket.send).toHaveBeenCalledWith(
      withAnyUUID(JSON.stringify({
          event: "student.ready",
          roomName: "room-1",
      }))
    );
  });

  it("redirects on session.in_progress", () => {
    initStudentLobby({
      individualRoomName: "room-1",
      classRoomName: "room-2",
    });

    const socket = sockets["room-1"];

    socket.__trigger("message", {
      data: JSON.stringify({
        event: "session.in_progress",
        roomUrl: "/rooms/room-1/",
      }),
    });

    expect(window.location).toBe("/rooms/room-1/");
  });

  it("redirects on session.start", () => {
    initStudentLobby({
      individualRoomName: "room-1",
      classRoomName: "room-2",
    });

    const socket = sockets["room-2"];

    socket.__trigger("message", {
      data: JSON.stringify({
        event: "session.start",
        roomUrl: "/rooms/room-2/",
      }),
    });

    expect(window.location).toBe("/rooms/room-2/");
  });

  it("does not redirect on unrelated events", () => {
    initStudentLobby({
      individualRoomName: "room-1",
      classRoomName: "room-2",
    });

    const socket = sockets["room-1"];

    socket.__trigger("message", {
      data: JSON.stringify({
        event: "ping",
        roomUrl: "/should-not-redirect/",
      }),
    });

    expect(window.location).not.toBe("/should-not-redirect/");
  });
});
