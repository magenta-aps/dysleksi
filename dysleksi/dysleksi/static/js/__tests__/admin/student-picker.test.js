/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { StudentPicker } from "../../admin/student-picker.js";

const mockDoc = `
    <div class="outside"></div>
    <div class="student-picker">
        <button class="picker-toggle" data-group-placeholder="Vælg klasser" data-single-placeholder="Vælg elev" data-count="%(count)s valgt"></button>
        <div class="picker-panel d-none">
            <div class="picker-class" data-class-pk="1" data-class-name="1.A">
                <div class="picker-class-header">
                    <input type="checkbox" class="class-check">
                    <span>1.A (2 elever)</span>
                </div>
                <div class="picker-students">
                    <div><input type="checkbox" name="students" value="1" id="s1-1"><label for="s1-1">Aja Berthelsen</label></div>
                    <div><input type="checkbox" name="students" value="2" id="s1-2"><label for="s1-2">Hans Olsen</label></div>
                </div>
            </div>
            <div class="picker-class" data-class-pk="2" data-class-name="2.B">
                <div class="picker-class-header">
                    <input type="checkbox" class="class-check">
                    <span>2.B (1 elev)</span>
                </div>
                <div class="picker-students">
                    <div><input type="checkbox" name="students" value="3" id="s2-3"><label for="s2-3">Nuka Lynge</label></div>
                </div>
            </div>
        </div>
        <input type="hidden" name="klasse">
    </div>
`;

describe("StudentPicker", () => {
    let picker;
    const $ = (selector) => document.querySelector(selector);
    const click = (selector) => $(selector).click();
    const checked = () =>
        [...document.querySelectorAll("input[name=students]:checked")].map(
            (input) => input.value,
        );

    beforeEach(() => {
        document.body.innerHTML = mockDoc;
        picker = new StudentPicker($(".student-picker"));
    });

    it("starts with nothing selected", () => {
        expect($(".picker-toggle").textContent).toBe("Vælg klasser");
        expect($("input[name=klasse]").value).toBe("");
    });

    it("toggles on click and closes on click outside", () => {
        click(".picker-toggle");
        expect(picker.panel.classList).not.toContain("d-none");
        click(".picker-toggle");
        expect(picker.panel.classList).toContain("d-none");
        click(".picker-toggle");
        click(".outside");
        expect(picker.panel.classList).toContain("d-none");
    });

    it("folds a class", () => {
        click("[data-class-pk='1'] span");
        expect($("[data-class-pk='1']").classList).toContain("folded");
    });

    it("selects all students in a class", () => {
        click("#s2-3");
        click("[data-class-pk='1'] .class-check");
        expect(checked()).toStrictEqual(["1", "2"]);
        expect($("input[name=klasse]").value).toBe("1");
        expect($(".picker-toggle").textContent).toBe("1.A: 2 valgt");

        click("[data-class-pk='1'] .class-check");
        expect(checked()).toStrictEqual([]);
    });

    it("only selects students from a single class", () => {
        click("#s1-1");
        expect($("[data-class-pk='1'] .class-check").indeterminate).toBeTruthy();
        click("#s1-2");
        expect($("[data-class-pk='1'] .class-check").checked).toBeTruthy();
        click("#s2-3");
        expect(checked()).toStrictEqual(["3"]);
        expect($("input[name=klasse]").value).toBe("2");
        click("#s2-3");
        expect(checked()).toStrictEqual([]);
    });

    it("only selects a single student in single mode", () => {
        click("#s1-1");
        picker.setSingle(true);
        expect(checked()).toStrictEqual([]);
        expect($(".picker-toggle").textContent).toBe("Vælg elev");

        click(".picker-toggle");
        click("#s1-1");
        click("#s1-2");
        expect(checked()).toStrictEqual(["2"]);
        expect(picker.panel.classList).toContain("d-none");
        expect($(".picker-toggle").textContent).toBe("Hans Olsen (1.A)");

        picker.setSingle(true);
        expect(checked()).toStrictEqual(["2"]);
    });
});
