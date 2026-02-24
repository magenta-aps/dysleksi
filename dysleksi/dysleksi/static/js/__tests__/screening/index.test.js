/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi, assert } from "vitest";
import * as individualTestData from './individualtest.json' with { type: 'json' }
import * as groupTestData from './grouptest.json' with { type: 'json' }
import * as individual_teacher from "../../screening/individual/teacher.js";
import * as individual_student from "../../screening/individual/student.js";
import * as group_teacher from "../../screening/group/teacher.js";
import * as group_student from "../../screening/group/student.js";
import { start } from "../../screening";


describe("Startup teacher test", () => {
    let socket;
    let wsGetter;

    let initIndividualTeacher;
    let initIndividualStudent;
    let initGroupTeacher;
    let initGroupStudent;

    beforeEach(() => {
        socket = {
            addEventListener: vi.fn(),
            send: vi.fn(),
        };
        wsGetter = vi.fn().mockReturnValue(socket);

        initIndividualTeacher = vi.spyOn(individual_teacher, "initTeacher").mockImplementation(() => {});
        initIndividualStudent = vi.spyOn(individual_student, "initStudent").mockImplementation(() => {});
        initGroupTeacher = vi.spyOn(group_teacher, "initTeacher").mockImplementation(() => {});
        initGroupStudent = vi.spyOn(group_student, "initStudent").mockImplementation(() => {});
    });

    afterEach(() => {
        initIndividualTeacher.mockReset();
        initIndividualStudent.mockReset();
        initGroupTeacher.mockReset();
        initGroupStudent.mockReset();
    });

    it("invalid test", async () => {
        document.body.innerHTML = `
            <div class="container" 
                data-test-type="invalid_type" 
                data-role="teacher" 
                data-room-name="room_1" 
                data-assignment-id="1"
            >
                <script type="application/json" id="test_contents">
                ${JSON.stringify(individualTestData)}
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
        } catch (e) {}

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
                <script type="application/json" id="test_contents">
                ${JSON.stringify(individualTestData)}
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
                <script type="application/json" id="test_contents">
                ${JSON.stringify(groupTestData)}
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

    it("individual student test", async () => {
        document.body.innerHTML = `
            <div class="container" 
                data-test-type="individual" 
                data-role="student" 
                data-room-name="room_1" 
                data-assignment-id="1"
            >
                <script type="application/json" id="test_contents">
                ${JSON.stringify(individualTestData)}
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
                data-room-name="room_1" 
                data-assignment-id="1"
            >
                <script type="application/json" id="test_contents">
                ${JSON.stringify(groupTestData)}
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

});
