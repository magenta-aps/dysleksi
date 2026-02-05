export class InstructionSequenceRunner {

    constructor(instructions, domElements) {
        this.instructions = instructions;
        this.domElements = domElements;
    }

    getEl(id) {
        const el = document.getElementById(id);
        return el;
    }

    async run() {
        for (const instruction of this.instructions) {
            await this.executeInstruction(instruction);
            const delay = instruction.delayAfter;

            if (delay > 0) {
                await this.sleep(delay);
            }
        }
    }


    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async executeInstruction(instr) {
        const { action, element, url } = instr;
        console.log(
          "Executing",
          action,
          ...(element != null ? ["on element", element] : []),
          ...(url != null ? ["with url", url] : []),
        );

        switch (action) {
            case "show":
                this.domElements.showElement(this.getEl(element));
                break;

            case "hide":
                this.domElements.hideElement(this.getEl(element));
                break;

            case "fadeIn":
                this.domElements.fadeIn(this.getEl(element));
                break;

            case "fadeOut":
                this.domElements.fadeOut(this.getEl(element));
                break;

            case "highlight":
                this.domElements.highlight(this.getEl(element));
                break;

            case "select":
                this.domElements.toggleButtonSelected(this.getEl(element), true);
                break;

            case "playSound":
                await this.playSound(url);
                break;
        }
    }

    playSound(url) {
        return new Promise(resolve => {
            const audio = new Audio(url);
            audio.addEventListener("ended", resolve);
            audio.addEventListener("error", resolve);
            audio.play();
        });
    }
}
