export class Wizard {
    currentStep;
    domElem;
    nextBtn;
    prevBtn;
    #fields;

    constructor(domElem) {
        this.domElem = domElem;
        this.nextBtn = this.domElem.querySelector('button.next-btn');
        this.prevBtn = this.domElem.querySelector('button.prev-btn');
        this.confirmBtn = this.domElem.querySelector('button.confirm-btn');

        this.currentStep = 1;
        this.totalSteps = this.domElem.querySelectorAll('fieldset').length;

        // Reset wizard when modal dialog opens
        this.domElem.addEventListener('show.bs.modal', () => this.#reset());

        // Hook events for buttons
        this.nextBtn.addEventListener('click', () => this.gotoNextStep());
        this.prevBtn.addEventListener('click', () => this.gotoPrevStep());
        this.confirmBtn.addEventListener('click', () => this.submit());

        // Hook events for progress bar steps
        const progressBarSteps = this.domElem.querySelectorAll(
            'ul.modal-progress li.list-group-item'
        );
        for (const progressBarStep of progressBarSteps) {
            progressBarStep.addEventListener('click', (evt) => {
                // Find the step that the user clicked
                const step = this.getProgressBarStep(evt);
                // Update
                this.gotoStep(step);
            });
        }

        // Hook events for all form fields on wizard
        this.#fields = this.domElem.querySelectorAll('form input, form select');
        for (const wizardField of this.#fields) {
            wizardField.addEventListener('change', (evt) => this.#validateFields(evt));
        }

        // Initial UI update
        this.#update();
    }

    gotoNextStep() {
        // Update view model
        this.currentStep += ((this.currentStep + 1) > this.totalSteps) ? 0 : 1;
        // Update UI
        this.#update()
    }

    gotoPrevStep() {
        // Update view model
        this.currentStep -= ((this.currentStep - 1) <= 0) ? 0 : 1;
        // Update UI
        this.#update();
    }

    gotoStep(step) {
        // Update view model (clip step number to accepted range)
        this.currentStep = Math.min(Math.max(step, 1), this.totalSteps);
        // Update UI
        this.#update();
    }

    getProgressBarStep(evt) {
        return parseInt(evt.target.closest('li').dataset.step);
    }

    submit() {
        const form = this.domElem.querySelector('form');
        form.submit();
    }

    isFormStepCompleted() {
        const currentFields = this.domElem.querySelectorAll(
            "fieldset[data-step='" + this.currentStep + "'] input, " +
            "fieldset[data-step='" + this.currentStep + "'] select"
        );

        if ((currentFields === null) || (currentFields.length === 0)) {
            // If there are no fields on the form step, then by
            // definition the form step is completed.
            return true;
        }

        // If any fields have an empty value, consider the form
        // step incomplete.
        for (const field of currentFields) {
            if (field.value === '') {
                return false;
            }
        }

        return true;
    }

    #validateFields(evt) {
        this.#updateBtn(this.nextBtn, this.isFormStepCompleted() === false);
    }

    #reset() {
        // Reset view model
        this.currentStep = 1;
        // Update UI
        this.#update();
        // Reset form fields if values have been entered/selected
        const wizardForm = this.domElem.querySelector('form');
        wizardForm.reset();
    }

    #updateBtn(btn, val) {
        btn.toggleAttribute('disabled', val);
        btn.classList.toggle('disabled', val);
    }

    #update() {
        // Update "next" button state
        this.#updateBtn(this.nextBtn, this.isFormStepCompleted() === false);
        this.nextBtn.toggleAttribute('hidden', this.currentStep === this.totalSteps);

        // Update "prev" button state
        this.#updateBtn(this.prevBtn, this.currentStep === 1);

        // Update "confirm" button state
        this.confirmBtn.toggleAttribute('hidden', this.currentStep < this.totalSteps);

        // Update progress bar
        const progressBarSteps = this.domElem.querySelectorAll(
            'ul.modal-progress li.list-group-item'
        );
        for (const progressBarStep of progressBarSteps) {
            const progressBarStepNum = parseInt(progressBarStep.dataset.step);
            // Toggle 'disabled' class depending on where we are in the flow
            progressBarStep.classList.toggle(
                'disabled',
                progressBarStepNum > this.currentStep,
            );
        }

        // Update currently visible fieldset
        const fieldsets = this.domElem.querySelectorAll('fieldset');
        for (const fieldset of fieldsets) {
            const fieldsetNum = parseInt(fieldset.dataset.step);
            // Set current fieldset to visible, and all others to hidden
            fieldset.classList.toggle(
                'd-none',
                fieldsetNum !== this.currentStep,
            );
        }

        // Update summary table (only visible on last step)
        for (const field of this.#fields) {
            const summaryField = this.domElem.querySelector("[data-id='" + field.id + "']");
            if (summaryField !== null) {
                summaryField.innerHTML = this.#getSummaryValue(field);
            }
        }
    }

    #getSummaryValue(field) {
        if (field.tagName.toLowerCase() === 'select') {
            return field.options[field.selectedIndex].label;
        }

        return field.value;
    }
}

export function initWizards() {
    // Auto-instantiation: find all wizard modals in document, and instantiate
    // a `Wizard` instance for each.
    let wizards = [];
    const wizardElems = document.querySelectorAll('div.modal.wizard');

    for (const wizardElem of wizardElems) {
        wizards.push(new Wizard(wizardElem));
    }

    return wizards;
}

document.addEventListener('DOMContentLoaded', initWizards);
