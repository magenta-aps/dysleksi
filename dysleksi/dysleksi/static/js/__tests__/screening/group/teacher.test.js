/**
 * @vitest-environment jsdom
 */
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock all imports
vi.mock("../../../screening/controlroom.js", () => {
    class EventTable {}

    class ActionButtons {
        showButtons() {}
    }

    class NoteField {
        show() {}
    }

    class QuestionView {
        show() {}
    }

    // TeacherView mock records constructor calls
    const TeacherView = vi.fn();

    return {
        EventTable,
        ActionButtons,
        NoteField,
        QuestionView,
        TeacherView,
    };
});

vi.mock("../../../ws.js", () => ({
    getWebSocket: vi.fn(() => "mockedSocket"),
}));

import { initTeacher } from "../../../screening/group/teacher.js";
import {
    EventTable,
    ActionButtons,
    NoteField,
    QuestionView,
    TeacherView,
} from "../../../screening/controlroom.js";
import { getWebSocket } from "../../../ws.js";

describe("initTeacher", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should create all components, call methods, and create TeacherView", () => {
        const roomName = "room1";
        const assignmentId = 42;
        const testObj = { id: 1 };

        initTeacher(roomName, assignmentId, testObj);

        // TeacherView constructor called
        expect(TeacherView).toHaveBeenCalledTimes(1);

        const args = TeacherView.mock.calls[0];
        expect(args[0]).toBe(roomName);
        expect(args[1]).toBe(testObj);
        expect(args[2]).toBe(assignmentId);
        expect(args[3]).toBe(getWebSocket);
        expect(args[4]).toBeInstanceOf(EventTable);
        expect(args[5]).toBeInstanceOf(ActionButtons);
        expect(args[6]).toBeInstanceOf(NoteField);
        expect(args[7]).toBeInstanceOf(QuestionView);
    });
});
