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
        this.classChoice = this.element(".class-choice", this.updateClassChoice);

        // Elements that are updated by event handlers
        this.studentChoice = this.element(".student-choice");
        this.classTestChoice = this.element(".class-test-choice");
        this.classTestPartChoice = this.element(".class-test-part-choice");
        this.studentTestChoice = this.element(".student-test-choice");
        this.studentTestPartChoice = this.element(".student-test-part-choice");
        this.startDateTime = this.element(".start-datetime");
        this.endDateTime = this.element(".end-datetime");
        this.hasEnd = this.element("#id_has_end");

        for (const choice of [this.classTestChoice, this.studentTestChoice]) {
            const select = choice.querySelector("select");
            select.addEventListener("change", () => this.updateTestContents(choice));
            this.updateTestContents(choice);
        }

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

        this.displayMultiple("[data-class-pk]", (elem) => {
            if (this.state.isGroup) {
                const select = this.classChoice.querySelector("select");
                const currentClassPk = select.options[select.selectedIndex].value;
                return elem.dataset["classPk"] === currentClassPk;
            }
            return false;
        });
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

    updateTestContents(choice) {
        const select = choice.querySelector("select");
        const parts = select.options[select.selectedIndex].dataset.parts ?? "[]";
        const list = choice.querySelector(".test-contents");
        list.replaceChildren(
            ...JSON.parse(parts).map((name) => {
                const item = document.createElement("li");
                item.textContent = name;
                return item;
            }),
        );
        this.display(list, list.children.length > 0);
    }

    updateIsImmediate(evt) {
        this.updateState(evt, "isImmediate", "y");
        this.display(this.startDateTime, !this.state.isImmediate);
        if (this.state.isImmediate) {
            this.#toggleEnd(false);
            this.clearDateValue(this.startDateTime);
        }
    }

    updateClassChoice(evt) {
        this.displayMultiple("[data-class-pk]", (elem) => {
            return elem.dataset["classPk"] === evt.target.value;
        });
    }

    addEnd(evt) {
        evt.preventDefault();
        this.#toggleEnd(true);
    }

    removeEnd(evt) {
        evt.preventDefault();
        this.#toggleEnd(false);
    }

    #toggleEnd(state) {
        this.state.hasEndDate = state;
        this.display(this.endDateTime, this.state.hasEndDate);
        this.display(this.addEndBtn, !this.state.hasEndDate);
        this.clearDateValue(this.endDateTime);
        this.hasEnd.value = state ? "y" : "n";
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

    displayMultiple(selector, callback) {
        const elems = this.domElem.querySelectorAll(selector);
        for (const elem of elems) {
            elem.classList.toggle("d-none", !callback(elem));
        }
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
