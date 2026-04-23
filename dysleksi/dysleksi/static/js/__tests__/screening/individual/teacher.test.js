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

    class QuestionView {
        show() {}
    }

    class ElapsedTimeView {}

    class AudioIndicator {}

    // TeacherView mock records constructor calls
    const TeacherView = vi.fn();

    return {
        EventTable,
        ActionButtons,
        ElapsedTimeView,
        QuestionView,
        AudioIndicator,
        TeacherView,
    };
});

vi.mock("../../../ws.js", () => ({
    getWebSocket: vi.fn(() => "mockedSocket"),
}));

import { initTeacher } from "../../../screening/individual/teacher.js";
import {
    EventTable,
    ActionButtons,
    ElapsedTimeView,
    QuestionView,
    TeacherView,
    AudioIndicator,
} from "../../../screening/controlroom.js";
import { getWebSocket } from "../../../ws.js";

describe("initTeacher", () => {
    let showButtonsSpy, questionShowSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        showButtonsSpy = vi.spyOn(ActionButtons.prototype, "showButtons");
        questionShowSpy = vi.spyOn(QuestionView.prototype, "show");
    });

    it("should create all components, call methods, and create TeacherView", () => {
        const assignmentId = 42;
        const testObj = { id: 1 };

        initTeacher(assignmentId, testObj);

        // Methods called
        expect(showButtonsSpy).toHaveBeenCalled();
        expect(questionShowSpy).toHaveBeenCalled();

        // TeacherView constructor called
        expect(TeacherView).toHaveBeenCalledTimes(1);

        const args = TeacherView.mock.calls[0];
        expect(args[0]).toBe(testObj);
        expect(args[1]).toBe(assignmentId);
        expect(args[2]).toBe(getWebSocket);
        expect(args[3]).toBeInstanceOf(EventTable);
        expect(args[4]).toBeInstanceOf(ActionButtons);
        expect(args[5]).toBeNull();
        expect(args[6]).toBeInstanceOf(QuestionView);
        expect(args[7]).toBeInstanceOf(ElapsedTimeView);
        expect(args[8]).toBeInstanceOf(AudioIndicator);
    });
});
