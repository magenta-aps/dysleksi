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
            </fieldset>
            <fieldset data-step="2">
                <input type="text" name="bar" id="bar" />
                <input type="text" name="baz" id="baz" />
            </fieldset>
            <fieldset data-step="3" class="d-none">
                <div class="summary">
                    <span data-id="foo"></span>
                    <span data-id="bar"></span>
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
    }

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
        select.dispatchEvent(new Event('change'));
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
        const select = document.querySelector("select");
        select.value = "42";
        const input = document.querySelector("input");
        input.value = "DEF";
        // Act
        const wizard = getInstance();
        wizard.gotoStep(3);
        // Assert
        const summaryValueFoo = wizard.domElem.querySelector("[data-id='foo']");
        expect(summaryValueFoo.innerHTML).toBe("ABC");
        const summaryValueBar = wizard.domElem.querySelector("[data-id='bar']");
        expect(summaryValueBar.innerHTML).toBe("DEF");
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
