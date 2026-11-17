import { blocktranslate } from "../i18n.js";

export class StudentPicker {
    constructor(domElem) {
        this.domElem = domElem;
        this.toggle = domElem.querySelector(".picker-toggle");
        this.panel = domElem.querySelector(".picker-panel");
        this.klasse = domElem.querySelector("input[name=klasse]");
        this.classes = [...domElem.querySelectorAll(".picker-class")];

        this.toggle.addEventListener("click", () =>
            this.panel.classList.toggle("d-none"),
        );
        document.addEventListener("click", (evt) => {
            if (!domElem.contains(evt.target)) {
                this.panel.classList.add("d-none");
            }
        });
        for (const cls of this.classes) {
            const header = cls.querySelector(".picker-class-header");
            header.addEventListener("click", (evt) => {
                if (evt.target.classList.contains("class-check")) {
                    this.selectClass(cls, evt.target.checked);
                } else {
                    cls.classList.toggle("folded");
                }
            });
            for (const input of this.studentInputs(cls)) {
                input.addEventListener("change", () => this.selectStudent(cls, input));
            }
        }
        this.update();
    }

    get single() {
        return this.domElem.classList.contains("single");
    }

    setSingle(single) {
        if (single === this.single) {
            return;
        }
        this.domElem.classList.toggle("single", single);
        this.uncheck();
        this.update();
    }

    studentInputs(elem) {
        return [...elem.querySelectorAll("input[name=students]")];
    }

    uncheck(predicate = () => true) {
        for (const input of this.studentInputs(this.domElem)) {
            if (predicate(input)) {
                input.checked = false;
            }
        }
    }

    selectClass(cls, checked) {
        this.uncheck();
        for (const input of this.studentInputs(cls)) {
            input.checked = checked;
        }
        this.update();
    }

    selectStudent(cls, input) {
        if (input.checked) {
            // Only students from a single class can be selected (or a single student)
            this.uncheck(
                (other) => other !== input && (this.single || !cls.contains(other)),
            );
            if (this.single) {
                this.panel.classList.add("d-none");
            }
        }
        this.update();
    }

    update() {
        const checked = this.studentInputs(this.domElem).filter(
            (input) => input.checked,
        );
        const cls = checked[0]?.closest(".picker-class");
        this.klasse.value = cls?.dataset.classPk ?? "";

        for (const c of this.classes) {
            const inputs = this.studentInputs(c);
            const count = inputs.filter((input) => input.checked).length;
            const box = c.querySelector(".class-check");
            box.checked = count > 0 && count === inputs.length;
            box.indeterminate = count > 0 && count < inputs.length;
        }

        const data = this.toggle.dataset;
        if (checked.length === 0) {
            this.toggle.textContent = this.single
                ? data.singlePlaceholder
                : data.groupPlaceholder;
        } else if (this.single) {
            const name = checked[0].labels[0].textContent;
            this.toggle.textContent = `${name} (${cls.dataset.className})`;
        } else {
            const count = blocktranslate(data.count, { count: checked.length });
            this.toggle.textContent = `${cls.dataset.className}: ${count}`;
        }
    }
}
