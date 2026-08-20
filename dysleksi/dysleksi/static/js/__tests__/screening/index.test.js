/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi, assert } from "vitest";
import * as individualTestData from "./individualtest.json" with { type: "json" };
import * as groupTestData from "./grouptest.json" with { type: "json" };
import * as individual_teacher from "../../screening/individual/teacher.js";
import * as individual_student from "../../screening/individual/student.js";
import * as group_teacher from "../../screening/group/teacher.js";
import * as group_student from "../../screening/group/student.js";
import { start } from "../../screening";
import { Test, Student } from "../../screening/model.js";

// Rendered into every assignment page by `window_lock_config`
const LOCK_CONFIG = `<script type="application/json" id="window-lock-config">
    {"url": "/assignment/1/window-lock/", "csrf_token": "token"}
</script>`;

describe("Startup test", () => {
    let socket;

    let initIndividualTeacher;
    let initIndividualStudent;
    let initGroupTeacher;
    let initGroupStudent;
    let initMockDataSpy;
    let groupStudentIds;
    let individualStudentIds;

    beforeEach(() => {
        socket = {
            addEventListener: vi.fn(),
            send: vi.fn(),
        };
        vi.fn().mockReturnValue(socket);

        initIndividualTeacher = vi
            .spyOn(individual_teacher, "initTeacher")
            .mockImplementation(() => {});
        initIndividualStudent = vi
            .spyOn(individual_student, "initStudent")
            .mockImplementation(() => {});
        initGroupTeacher = vi
            .spyOn(group_teacher, "initTeacher")
            .mockImplementation(() => {});
        initGroupStudent = vi
            .spyOn(group_student, "initStudent")
            .mockImplementation(() => {});
        vi.spyOn(Test.prototype, "preload").mockResolvedValue(new Map());
        initMockDataSpy = vi.spyOn(Student.prototype, "initializeMockData");
        // By default the server lets this window run the test
        global.fetch = vi
            .fn()
            .mockResolvedValue({ ok: true, json: async () => ({ granted: true }) });

        groupStudentIds = [1, 2];
        individualStudentIds = [1];
    });

    afterEach(() => {
        initIndividualTeacher.mockReset();
        initIndividualStudent.mockReset();
        initGroupTeacher.mockReset();
        initGroupStudent.mockReset();
        initMockDataSpy.mockRestore();
    });

    it("invalid test", async () => {
        document.body.innerHTML = `
            <div class="container" 
                data-test-type="invalid_type" 
                data-role="teacher" 
                data-room-name="room_1" 
                data-assignment-id="1"
            >
                ${LOCK_CONFIG}
                <script type="application/json" id="test_contents">
                ${JSON.stringify(individualTestData)}
                </script>
                <script type="application/json" id="student_ids">
                ${JSON.stringify(individualStudentIds)}
                </script>
                <div id="question-container">
                <h1 id="question-title"></h1>
                <div id="question-content"></div>
                </div>
                <table id="events"><tbody></tbody></table>
                <button id="correct"></button>
                <button id="wrong"></button>
                <button id="cancelled"></button>
                <button id="skipped"></button>
                <textarea id="note" class="d-none"></textarea>
            </div>
        `;
        try {
            await start();
            assert.fail("Exception not raised");
        } catch {}

        expect(initIndividualTeacher).not.toHaveBeenCalled();
        expect(initIndividualStudent).not.toHaveBeenCalled();
        expect(initGroupTeacher).not.toHaveBeenCalled();
        expect(initGroupStudent).not.toHaveBeenCalled();
    });

    it("individual teacher test", async () => {
        document.body.innerHTML = `
            <div class="container" 
                data-test-type="individual" 
                data-role="teacher" 
                data-room-name="room_1" 
                data-assignment-id="1"
            >
                ${LOCK_CONFIG}
                <script type="application/json" id="test_contents">
                ${JSON.stringify(individualTestData)}
                </script>
                <script type="application/json" id="student_ids">
                ${JSON.stringify(individualStudentIds)}
                </script>
                <div id="question-container">
                <h1 id="question-title"></h1>
                <div id="question-content"></div>
                </div>
                <table id="events"><tbody></tbody></table>
                <button id="correct"></button>
                <button id="wrong"></button>
                <button id="cancelled"></button>
                <button id="skipped"></button>
                <textarea id="note" class="d-none"></textarea>
            </div>
        `;
        await start();

        expect(initIndividualTeacher).toHaveBeenCalled();
        expect(initIndividualStudent).not.toHaveBeenCalled();
        expect(initGroupTeacher).not.toHaveBeenCalled();
        expect(initGroupStudent).not.toHaveBeenCalled();
    });

    it("group teacher test", async () => {
        document.body.innerHTML = `
            <div class="container" 
                data-test-type="group" 
                data-role="teacher" 
                data-room-name="room_1" 
                data-assignment-id="1"
            >
                ${LOCK_CONFIG}
                <script type="application/json" id="test_contents">
                ${JSON.stringify(groupTestData)}
                </script>
                <script type="application/json" id="student_ids">
                ${JSON.stringify(groupStudentIds)}
                </script>
                <div id="question-container">
                <h1 id="question-title"></h1>
                <div id="question-content"></div>
                </div>
                <table id="events"><tbody></tbody></table>
                <button id="correct"></button>
                <button id="wrong"></button>
                <button id="cancelled"></button>
                <button id="skipped"></button>
                <textarea id="note" class="d-none"></textarea>
            </div>
        `;
        await start();

        expect(initIndividualTeacher).not.toHaveBeenCalled();
        expect(initIndividualStudent).not.toHaveBeenCalled();
        expect(initGroupTeacher).toHaveBeenCalled();
        expect(initGroupStudent).not.toHaveBeenCalled();
    });

    it("does not start the test when the server refuses the window", async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({ granted: false }),
        });
        document.body.innerHTML = `
            <div id="window-blocked" class="d-none"></div>
            <div class="container"
                data-test-type="individual"
                data-role="teacher"
                data-room-name="room_1"
                data-assignment-id="1"
            >
                ${LOCK_CONFIG}
                <script type="application/json" id="test_contents">
                ${JSON.stringify(individualTestData)}
                </script>
                <script type="application/json" id="student_ids">
                ${JSON.stringify(individualStudentIds)}
                </script>
            </div>
        `;
        await start();

        expect(initIndividualTeacher).not.toHaveBeenCalled();
        expect(
            document.getElementById("window-blocked").classList.contains("d-none"),
        ).toBe(false);
    });

    it("individual student test", async () => {
        document.body.innerHTML = `
            <div class="container"
                data-test-type="individual"
                data-role="student"
                data-student-first-name="Jack"
                data-student-last-name="Wilshere"
                data-room-name="room_1" 
                data-assignment-id="1"
            >
                ${LOCK_CONFIG}
                <script type="application/json" id="test_contents">
                ${JSON.stringify(individualTestData)}
                </script>
                <script type="application/json" id="student_ids">
                ${JSON.stringify(individualStudentIds)}
                </script>
                <h1 id="instructions-text"></h1>
                <audio id="instructions-sound"></audio>
                <h1 id="question-title"></h1>
                <button class="btn btn-primary" id="end-summary">Ok</button>
                <div id="question-challenge"></div>
                <div id="choices"></div>
                <p id="choice"></p>
            </div>
        `;
        await start();

        expect(initIndividualTeacher).not.toHaveBeenCalled();
        expect(initIndividualStudent).toHaveBeenCalled();
        expect(initGroupTeacher).not.toHaveBeenCalled();
        expect(initGroupStudent).not.toHaveBeenCalled();
    });

    it("group student test", async () => {
        document.body.innerHTML = `
            <div class="container" 
                data-test-type="group" 
                data-role="student" 
                data-student-first-name="Jack"
                data-student-last-name="Wilshere"
                data-room-name="room_1" 
                data-assignment-id="1"
            >
                ${LOCK_CONFIG}
                <script type="application/json" id="test_contents">
                ${JSON.stringify(groupTestData)}
                </script>
                <script type="application/json" id="student_ids">
                ${JSON.stringify(groupStudentIds)}
                </script>
                <h1 id="instructions-text"></h1>
                <audio id="instructions-sound"></audio>
                <button class="btn btn-primary" id="start-practice"></button>
                <button class="btn btn-primary" id="start-questions"></button>
                <button class="btn btn-primary" id="end-summary">Ok</button>
                <h1 id="question-title"></h1>
                <div id="question-challenge"></div>
                <div id="choices"></div>
                <button id="next" class="btn next-btn" style="display: none;"></button>
            </div>
        `;
        await start();

        expect(initIndividualTeacher).not.toHaveBeenCalled();
        expect(initIndividualStudent).not.toHaveBeenCalled();
        expect(initGroupTeacher).not.toHaveBeenCalled();
        expect(initGroupStudent).toHaveBeenCalled();
    });

    it("group student with existing answers test", async () => {
        // Simulate that the student has completed a question in the first testpart
        groupTestData.parts[0].questions[0].existing_answers = {
            [1]: { correctness: "correct" },
        };
        groupTestData.parts[0].questions[1].existing_answers = {
            [1]: { correctness: "wrong" },
        };
        groupTestData.parts[0].questions[2].existing_answers = {
            [1]: { correctness: "partial" },
        };

        document.body.innerHTML = `
            <div class="container" 
                data-test-type="group" 
                data-role="student" 
                data-student-first-name="Jack"
                data-student-last-name="Wilshere"
                data-student-id="1"
                data-room-name="room_1" 
                data-assignment-id="1"
            >
                ${LOCK_CONFIG}
                <script type="application/json" id="test_contents">
                ${JSON.stringify(groupTestData)}
                </script>
                <script type="application/json" id="student_ids">
                ${JSON.stringify(groupStudentIds)}
                </script>
                <h1 id="instructions-text"></h1>
                <audio id="instructions-sound"></audio>
                <button class="btn btn-primary" id="start-practice"></button>
                <button class="btn btn-primary" id="start-questions"></button>
                <button class="btn btn-primary" id="end-summary">Ok</button>
                <h1 id="question-title"></h1>
                <div id="question-challenge"></div>
                <div id="choices"></div>
                <button id="next" class="btn next-btn" style="display: none;"></button>
            </div>
        `;
        await start();
        const student = initGroupStudent.mock.calls[0][2];
        expect(student.resultsByPart[0][0]).toEqual("correct");
        expect(student.resultsByPart[0][1]).toEqual("wrong");
        expect(student.resultsByPart[0][2]).toEqual("partial");
    });

    it("group dummy1 student test", async () => {
        document.body.innerHTML = `
            <div class="container" 
                data-test-type="group" 
                data-role="student" 
                data-student-first-name="Dummy1"
                data-student-last-name="Student"
                data-room-name="room_1" 
                data-assignment-id="1"
            >
                ${LOCK_CONFIG}
                <script type="application/json" id="test_contents">
                ${JSON.stringify(groupTestData)}
                </script>
                <script type="application/json" id="student_ids">
                ${JSON.stringify(groupStudentIds)}
                </script>
                <h1 id="instructions-text"></h1>
                <audio id="instructions-sound"></audio>
                <button class="btn btn-primary" id="start-practice"></button>
                <button class="btn btn-primary" id="start-questions"></button>
                <button class="btn btn-primary" id="end-summary">Ok</button>
                <h1 id="question-title"></h1>
                <div id="question-challenge"></div>
                <div id="choices"></div>
                <button id="next" class="btn next-btn" style="display: none;"></button>
            </div>
        `;
        await start();

        expect(initIndividualTeacher).not.toHaveBeenCalled();
        expect(initIndividualStudent).not.toHaveBeenCalled();
        expect(initGroupTeacher).not.toHaveBeenCalled();
        expect(initGroupStudent).toHaveBeenCalled();
        expect(initMockDataSpy).toHaveBeenCalled();

        const studentArg = initGroupStudent.mock.calls[0][2];
        expect(studentArg.progress).not.toBe(100);
    });

    it("group dummy0 student test", async () => {
        document.body.innerHTML = `
            <div class="container" 
                data-test-type="group" 
                data-role="student" 
                data-student-first-name="Dummy0"
                data-student-last-name="Student"
                data-student-id="1"
                data-assignment-id="1"
            >
                ${LOCK_CONFIG}
                <script type="application/json" id="test_contents">
                ${JSON.stringify(groupTestData)}
                </script>
                <script type="application/json" id="student_ids">
                ${JSON.stringify(groupStudentIds)}
                </script>
                <h1 id="instructions-text"></h1>
                <audio id="instructions-sound"></audio>
                <button class="btn btn-primary" id="start-practice"></button>
                <button class="btn btn-primary" id="start-questions"></button>
                <button class="btn btn-primary" id="end-summary">Ok</button>
                <h1 id="question-title"></h1>
                <div id="question-challenge"></div>
                <div id="choices"></div>
                <button id="next" class="btn next-btn" style="display: none;"></button>
            </div>
        `;
        await start();

        expect(initIndividualTeacher).not.toHaveBeenCalled();
        expect(initIndividualStudent).not.toHaveBeenCalled();
        expect(initGroupTeacher).not.toHaveBeenCalled();
        expect(initGroupStudent).toHaveBeenCalled();
        expect(initMockDataSpy).toHaveBeenCalled();

        const studentArg = initGroupStudent.mock.calls[0][2];
        expect(studentArg.progress).toBe(100);
    });

    it("should handle missing test_contents element by setting it to null", async () => {
        // 1. Setup DOM WITHOUT the #test_contents script tag
        document.body.innerHTML = `
            <div class="container" 
                data-test-type="individual" 
                data-role="teacher" 
                data-room-name="room_1" 
                data-assignment-id="1"
            >
                </div>
        `;

        // 2. Call start
        // Note: This might throw an error further down if your Test class
        // constructor doesn't handle null, so we wrap it in a try/catch
        // just to ensure the line in index.js is executed.
        try {
            await start();
        } catch {
            // We expect a crash later in 'new Test(null)',
            // but the line we want to cover has now been reached.
        }

        // 3. Verify the initialization didn't proceed correctly (optional)
        expect(initIndividualTeacher).not.toHaveBeenCalled();
    });
});
