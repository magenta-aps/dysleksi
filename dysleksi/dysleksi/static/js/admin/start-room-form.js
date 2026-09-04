export class Form {
    constructor(domElem) {
        this.domElem = domElem;

        // Elements with event handlers
        this.testTypeChoice = this.element(".test-type-choice", this.updateTestType);
        this.isTestPartChoice = this.element(
            ".is-test-part-choice",
            this.updateIsTestPart,
        );
        this.isImmediateChoice = this.element(
            ".is-immediate-choice",
            this.updateIsImmediate,
        );
        this.addEndBtn = this.element(".add-end", this.addEnd);
        this.removeEndBtn = this.element(".remove-end", this.removeEnd);

        // Elements that are updated by event handlers
        this.classChoice = this.element(".class-choice");
        this.studentChoice = this.element(".student-choice");
        this.classTestChoice = this.element(".class-test-choice");
        this.classTestPartChoice = this.element(".class-test-part-choice");
        this.studentTestChoice = this.element(".student-test-choice");
        this.studentTestPartChoice = this.element(".student-test-part-choice");
        this.startDateTime = this.element(".start-datetime");
        this.endDateTime = this.element(".end-datetime");

        // Internal state
        this.state = {
            isGroup: true,
            isTest: true,
            isImmediate: true,
            hasEndDate: false,
        };
    }

    updateTestType(evt) {
        this.updateState(evt, "isGroup", "group");

        this.display(this.classChoice, this.state.isGroup);
        this.display(this.classTestChoice, this.state.isGroup && this.state.isTest);
        this.display(
            this.classTestPartChoice,
            this.state.isGroup && !this.state.isTest,
        );

        this.display(this.studentChoice, !this.state.isGroup);
        this.display(this.studentTestChoice, !this.state.isGroup && this.state.isTest);
        this.display(
            this.studentTestPartChoice,
            !this.state.isGroup && !this.state.isTest,
        );
    }

    updateIsTestPart(evt) {
        this.updateState(evt, "isTest", "test");

        this.display(this.classTestChoice, this.state.isTest && this.state.isGroup);
        this.display(
            this.classTestPartChoice,
            !this.state.isTest && this.state.isGroup,
        );
        this.display(this.studentTestChoice, this.state.isTest && !this.state.isGroup);
        this.display(
            this.studentTestPartChoice,
            !this.state.isTest && !this.state.isGroup,
        );
    }

    updateIsImmediate(evt) {
        this.updateState(evt, "isImmediate", "y");
        this.display(this.startDateTime, !this.state.isImmediate);
        if (this.state.isImmediate) {
            this.display(this.endDateTime, false);
            this.clearDateValue(this.startDateTime);
            this.clearDateValue(this.endDateTime);
        }
    }

    addEnd(evt) {
        this.#toggleEnd(evt, true);
    }

    removeEnd(evt) {
        this.#toggleEnd(evt, false);
    }

    #toggleEnd(evt, state) {
        evt.preventDefault();
        this.state.hasEndDate = state;
        this.display(this.endDateTime, this.state.hasEndDate);
        this.display(this.addEndBtn, !this.state.hasEndDate);
        this.clearDateValue(this.endDateTime);
    }

    updateState(evt, name, value) {
        if (evt.target === undefined || evt.target.value === undefined) {
            return;
        }
        this.state[name] = evt.target.value === value;
    }

    element(selector, handler) {
        const elem = this.domElem.querySelector(selector);
        if (handler !== null && handler !== undefined) {
            elem.addEventListener("click", handler.bind(this));
        }
        return elem;
    }

    display(element, state) {
        element.classList.toggle("d-none", !state);
    }

    clearDateValue(element) {
        const inputEl = element.querySelector("input[type=datetime-local]");
        inputEl.value = null;
    }
}

export function initForm() {
    new Form(document.querySelector("form.start-room"));
}

document.addEventListener("DOMContentLoaded", initForm);
