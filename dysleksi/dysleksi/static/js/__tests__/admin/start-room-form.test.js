/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { Form, initForm } from "../../admin/start-room-form.js";

const mockDoc = `
    <form class="start-room">
        <div class="test-type-choice">
            <input class="form-check-input" type="radio" name="test_type" value="group" required id="id_test_type_0" checked>
            <input class="form-check-input" type="radio" name="test_type" value="individual" required id="id_test_type_1">
        </div>
        </div>
        <div class="class-choice">
            <select name="klasse" class="form-select" id="id_klasse">
                <option value="" selected>- Vælg en valgmulighed -</option>
                <option value="22">Dansk 1</option>
            </select>
        </div>
        <div class="student-choice d-none">
            <select name="student" class="form-select" id="id_student">
                <option value="" selected>- Vælg en valgmulighed -</option>
                <option value="8">Dummy0 Student0 (0.C)</option>
            </select>
        </div>
        <div class="is-test-part-choice">
            <input class="form-check-input" type="radio" name="is_test_part" value="test" required id="id_is_test_part_0" checked>
            <input class="form-check-input" type="radio" name="is_test_part" value="part" required id="id_is_test_part_1">
        </div>
        <div class="class-test-choice">
            <select name="class_test" class="form-select" id="id_class_test">
                <option value="" selected>- Vælg en valgmulighed -</option>
                <option value="1">Midt 1. klasse (dummy)</option>
            </select>
        </div>
        <div class="class-test-part-choice d-none">
            <input class="form-check-input" type="checkbox" name="class_test_parts" value="1" id="id_class_test_parts_0">
        </div>
        <div class="student-test-choice d-none">
            <select name="student_test" class="form-select" id="id_student_test">
                <option value="" selected>- Vælg en valgmulighed -</option>
                <option value="2">Midt 1. klasse (dummy)</option>
            </select>
        </div>
        <div class="student-test-part-choice d-none">
            <input class="form-check-input" type="checkbox" name="student_test_parts" value="4" id="id_student_test_parts_0">
        </div>
        <div class="is-immediate-choice">
            <input class="form-check-input" type="radio" name="is_immediate" value="y" required id="id_is_immediate_0" checked>
            <input class="form-check-input" type="radio" name="is_immediate" value="n" required id="id_is_immediate_1">
        </div>
        <div class="start-datetime d-none">
            <input type="datetime-local" name="start_datetime" class="form-control" id="id_start_datetime">
            <button class="add-end"></button>
        </div>
        <div class="end-datetime d-none">
            <input type="datetime-local" name="end_datetime" class="form-control" id="id_end_datetime">
            <button class="remove-end"></button>
        </div>
    </form>
`;

describe("Form", () => {
    const getInstance = () => {
        return new Form(document.querySelector("form.start-room"));
    };

    beforeEach(() => {
        document.body.innerHTML = mockDoc;
    });

    it("initializes", () => {
        const form = getInstance();
        expect(form.domElem).not.toBeNull();
        expect(form.classChoice).not.toBeNull();
        expect(form.studentChoice).not.toBeNull();
        expect(form.classTestChoice).not.toBeNull();
        expect(form.classTestPartChoice).not.toBeNull();
        expect(form.studentTestChoice).not.toBeNull();
        expect(form.studentTestPartChoice).not.toBeNull();
        expect(form.startDateTime).not.toBeNull();
        expect(form.endDateTime).not.toBeNull();
        expect(form.state).toStrictEqual({
            isGroup: true,
            isTest: true,
            isImmediate: true,
            hasEndDate: false,
        });
    });

    it("handles the group/individual choice", () => {
        const form = getInstance();
        const individual = form.domElem.querySelector(
            "input[name=test_type][value=individual]",
        );
        individual.dispatchEvent(new Event("click", { bubbles: true }));
        expect(form.state["isGroup"]).toBeFalsy();
    });

    it("handles the test/part choice", () => {
        const form = getInstance();
        const part = form.domElem.querySelector("input[name=is_test_part][value=part]");
        part.dispatchEvent(new Event("click", { bubbles: true }));
        expect(form.state["isTest"]).toBeFalsy();
    });

    it("handles the 'is immediate?' choice", () => {
        const form = getInstance();
        const yes = form.domElem.querySelector("input[name=is_immediate][value=y]");
        const no = form.domElem.querySelector("input[name=is_immediate][value=n]");
        // Switch away from default state
        no.dispatchEvent(new Event("click", { bubbles: true }));
        expect(form.state["isImmediate"]).toBeFalsy();
        // Switch back to default state
        yes.dispatchEvent(new Event("click", { bubbles: true }));
        expect(form.state["isImmediate"]).toBeTruthy();
        expect(form.endDateTime.classList).not.to.include(["d-none"]);
    });

    it("handles combining choices", () => {
        const form = getInstance();

        // 1. Simulate selecting "group" while "test part" is (already) false
        form.state["isTest"] = false;
        const group = form.domElem.querySelector("input[name=test_type][value=group]");
        group.dispatchEvent(new Event("click", { bubbles: true }));
        expect(form.state["isGroup"]).toBeTruthy();
        expect(form.state["isTest"]).toBeFalsy();

        // 2. Simulate selecting "test" while "group" is (already) false
        form.state["isGroup"] = false;
        const test = form.domElem.querySelector("input[name=is_test_part][value=test]");
        test.dispatchEvent(new Event("click", { bubbles: true }));
        expect(form.state["isGroup"]).toBeFalsy();
        expect(form.state["isTest"]).toBeTruthy();
    });

    it("handles adding end date", () => {
        const form = getInstance();
        form.addEndBtn.dispatchEvent(new Event("click", { bubbles: true }));
        expect(form.state["hasEndDate"]).toBeTruthy();
    });

    it("handles removing end date", () => {
        const form = getInstance();
        form.removeEndBtn.dispatchEvent(new Event("click", { bubbles: true }));
        expect(form.state["hasEndDate"]).toBeFalsy();
    });

    it("handles events without 'target.value'", () => {
        const form = getInstance();
        const evt = { target: { value: undefined } };
        form.updateState(evt);
    });
});

describe("initForm", () => {
    beforeEach(() => {
        document.body.innerHTML = mockDoc;
    });

    it("finds the 'start-room' form in document", () => {
        const form = initForm();
        expect(form).not.toBeNull();
    });
});
