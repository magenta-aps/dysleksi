/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Wizard, initWizards } from "../../admin/wizard.js";

const mockDoc = `
    <div class="modal wizard">
        <ul class="modal-progress">
            <li data-step="1" class="list-group-item"><span></span></li>
            <li data-step="2" class="list-group-item"><span></span></li>
            <li data-step="3" class="list-group-item disabled"><span></span></li>
        </ul>
        <form>
            <fieldset data-step="1" class="d-none">
                <select name="foo" id="foo">
                    <option value="">-</option>
                    <option value="42">ABC</option>
                </select>
                <button data-show="example1">
                <button data-hide="example2">
                <div data-toggle="yes=show:div.example1;no=hide:div.example2">
                    <input type="radio" name="toggle" id="toggle" value="yes" />
                    <input type="radio" name="toggle" id="toggle" value="no" />
                </div>
                <div class="d-none example1">
                    <input type="text" name="invisible" id="invisible" />
                </div>
                <div class="example2"></div>
            </fieldset>
            <fieldset data-step="2">
                <input type="text" name="bar" id="bar" />
                <input type="datetime-local" name="baz" id="baz" />
                <input type="number" name="quux" id="quux" /><!-- unused by summary -->
                <div>
                    <input type="checkbox" name="checkbox" id="checkbox1" value="1" checked />
                    <label for="checkbox1">Checkbox 1</label>
                    <input type="checkbox" name="checkbox" id="checkbox2" value="2" />
                    <label for="checkbox2">Checkbox 2</label>
                    <input type="checkbox" name="checkbox" id="checkbox3" value="3" checked />
                    <label for="checkbox3">Checkbox 3</label>
                </div>
                <div>
                    <input type="radio" name="radio" id="radio1" checked />
                    <label for="radio1">Radio 1</label>
                    <input type="radio" name="radio" id="radio2" />
                    <label for="radio2">Radio 2</label>
                </div>
                <div class="d-none">
                    <input type="text" name="hidden" id="hidden" />
                </div>
            </fieldset>
            <fieldset data-step="3" class="d-none">
                <div class="summary">
                    <span data-id="foo"></span>
                    <span data-id="bar"></span>
                    <span data-id="baz"></span>
                    <span data-id="checkbox"></span>
                    <span data-id="radio"></span>
                    <span data-id="hidden"></span>
                </div>
            </fieldset>
        </form>
        <button type="button" disabled class="prev-btn disabled"></button>
        <button type="button" disabled class="next-btn disabled"></button>
        <button type="button" hidden class="confirm-btn"></button>
    </div>
`;

describe("Wizard", () => {
    const getInstance = () => {
        return new Wizard(document.querySelector("div.modal.wizard"));
    };

    beforeEach(() => {
        document.body.innerHTML = mockDoc;
    });

    it("initializes", () => {
        const wizard = getInstance();
        expect(wizard.domElem).not.toBeNull();
        expect(wizard.currentStep).toBe(1);
        expect(wizard.totalSteps).toBe(3);
    });

    it("goes to the next step", () => {
        const wizard = getInstance();
        wizard.gotoNextStep();
        expect(wizard.currentStep).toBe(2);
    });

    it("cannot go beyond the last step", () => {
        const wizard = getInstance();
        wizard.currentStep = 3;
        wizard.gotoNextStep();
        expect(wizard.currentStep).toBe(3);
    });

    it("goes to the previous step", () => {
        const wizard = getInstance();
        wizard.currentStep = 3;
        wizard.gotoPrevStep();
        expect(wizard.currentStep).toBe(2);
    });

    it("cannot go below the first step", () => {
        const wizard = getInstance();
        wizard.gotoPrevStep();
        expect(wizard.currentStep).toBe(1);
    });

    it("cannot go below the first step", () => {
        const wizard = getInstance();
        wizard.gotoPrevStep();
        expect(wizard.currentStep).toBe(1);
    });

    it("goes directly to a numbered step", () => {
        const wizard = getInstance();
        wizard.gotoStep(2);
        expect(wizard.currentStep).toBe(2);
    });

    it("listens to 'next' button clicks", () => {
        const wizard = getInstance();
        const nextBtn = wizard.domElem.querySelector("button.next-btn");
        nextBtn.dispatchEvent(new Event("click"));
        expect(wizard.currentStep).toBe(2);
    });

    it("listens to 'previous' button clicks", () => {
        const wizard = getInstance();
        const prevBtn = wizard.domElem.querySelector("button.prev-btn");
        wizard.currentStep = 2;
        prevBtn.dispatchEvent(new Event("click"));
        expect(wizard.currentStep).toBe(1);
    });

    it("listens to progress bar step clicks", () => {
        const wizard = getInstance();
        const step = wizard.domElem.querySelector("li[data-step='2']");
        step.dispatchEvent(new Event("click"));
        expect(wizard.currentStep).toBe(2);
    });

    it("listens to 'confirm' button clicks", () => {
        const wizard = getInstance();
        const confirmBtn = wizard.domElem.querySelector("button.confirm-btn");
        wizard.submit = vi.fn();
        confirmBtn.dispatchEvent(new Event("click"));
        expect(wizard.submit).toHaveBeenCalled();
    });

    it("reads the step number from the clicked progress bar step", () => {
        const wizard = getInstance();
        const target = wizard.domElem.querySelector("li[data-step='2'] span");
        const step = wizard.getProgressBarStep(vi.fn({ target: target }));
        expect(step).toBe(2);
    });

    it("cannot proceed to next step if form step is incomplete", () => {
        const wizard = getInstance();
        const completed = wizard.isFormStepCompleted();
        expect(completed).toBeFalsy();
    });

    it("can proceed to next step if form step is complete", () => {
        const select = document.querySelector("select");
        select.value = "42";
        const wizard = getInstance();
        const completed = wizard.isFormStepCompleted();
        expect(completed).toBeTruthy();
    });

    it("enables the 'next' button if form step is completed", () => {
        const wizard = getInstance();
        const select = document.querySelector("select");
        const nextBtn = document.querySelector("button.next-btn");
        select.value = "42";
        select.dispatchEvent(new Event("change"));
        expect(wizard.isFormStepCompleted()).toBeTruthy();
        expect(nextBtn.disabled).toBeFalsy();
    });

    it("considers a step complete if it has no form elements", () => {
        const wizard = getInstance();
        wizard.gotoStep(3);
        const completed = wizard.isFormStepCompleted();
        expect(completed).toBeTruthy();
    });

    it("displays a confirmation page on the last step", () => {
        // Arrange: fill out `select` and `input` fields
        const select = document.querySelector("select#foo");
        select.value = "42";
        const textInput = document.querySelector("input#bar");
        textInput.value = "DEF";
        const datetimeInput = document.querySelector("input#baz");
        datetimeInput.value = "2026-01-01T12:00";
        // Act
        const wizard = getInstance();
        wizard.gotoStep(3);
        // Assert
        const selectDisplay = wizard.domElem.querySelector("[data-id='foo']");
        expect(selectDisplay.innerText).toBe("ABC");
        const textDisplay = wizard.domElem.querySelector("[data-id='bar']");
        expect(textDisplay.innerText).toBe("DEF");
        const datetimeDisplay = wizard.domElem.querySelector("[data-id='baz']");
        expect(datetimeDisplay.innerText).toBe("torsdag den 1. januar 2026 kl. 12.00");
    });

    it("submits a form", () => {
        const wizard = getInstance();
        const form = wizard.domElem.querySelector("form");
        const submit = vi.spyOn(form, "submit");
        wizard.submit();
        expect(submit).toBeCalled();
    });

    it("resets the form when the modal is (re)opened", () => {
        // Arrange
        const wizard = getInstance();
        const form = wizard.domElem.querySelector("form");
        form.reset = vi.fn();
        wizard.currentStep = 2;
        // Act: simulate modal opening
        wizard.domElem.dispatchEvent(new Event("show.bs.modal"));
        // Assert
        expect(wizard.currentStep).toBe(1);
        expect(form.reset).toBeCalled();
    });

    it("shows elements according to their 'data-show' attribute", () => {
        const wizard = getInstance();
        const btn = wizard.domElem.querySelector("button[data-show]");
        btn.dispatchEvent(new Event("click"));
        const div = wizard.domElem.querySelector("div.example1");
        expect(div.classList).not.toContain("d-none");
    });

    it("hides elements according to their 'data-hide' attribute", () => {
        const wizard = getInstance();
        const btn = wizard.domElem.querySelector("button[data-hide]");
        btn.dispatchEvent(new Event("click"));
        const div = wizard.domElem.querySelector("div.example2");
        expect(div.classList).toContain("d-none");
    });

    it("toggles elements according to their 'data-toggle' attribute", () => {
        const wizard = getInstance();
        const yes = wizard.domElem.querySelector("input[type='radio'][value='yes']");
        const no = wizard.domElem.querySelector("input[type='radio'][value='no']");
        // Test `yes=show` rule
        yes.checked = true;
        yes.dispatchEvent(new Event("click", { bubbles: true }));
        const example1 = wizard.domElem.querySelector("div.example1");
        expect(example1.classList).not.toContain("d-none");
        // Test `no=hide` rule
        no.checked = true;
        no.dispatchEvent(new Event("click", { bubbles: true }));
        const example2 = wizard.domElem.querySelector("div.example2");
        expect(example2.classList).toContain("d-none");
    });
});

describe("initWizards", () => {
    beforeEach(() => {
        document.body.innerHTML = mockDoc;
    });

    it("finds all wizard modals in document", () => {
        const wizards = initWizards();
        expect(wizards.length).toBe(1);
    });
});
