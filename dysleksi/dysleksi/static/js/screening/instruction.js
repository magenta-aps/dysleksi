export class InstructionSequenceRunner {

    constructor(instructions, domElements) {
        this.instructions = instructions;
        this.domElements = domElements;
        this.skipCurrent = false;
        this.skipAll = false;
        this._currentSkipResolver = null;
    }

    getEl(id) {
        const el = document.getElementById(id);
        return el;
    }

    async run() {
        this.skipAll = false;
        for (const instruction of this.instructions) {
            if (!this.skipAll) this.skipCurrent = false;
            if (this.skipAll) this.skipCurrent = true;

            await this.executeInstruction(instruction);

            if (this.skipCurrent) continue; // immediately go to next instruction

            const delay = instruction.delayAfter;
            if (delay > 0) {
                await this.sleep(delay);
            }
        }
    }

    // Sleep that can be skipped instantly
    sleep(ms) {
        if (this.skipCurrent) return Promise.resolve();

        return new Promise(resolve => {
            const timeout = setTimeout(resolve, ms);

            // Keep track of resolver for instant skip
            this._currentSkipResolver = () => {
                clearTimeout(timeout);
                resolve();
            };
        }).finally(() => {
            this._currentSkipResolver = null;
        });
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
        if (this.skipCurrent) return Promise.resolve();

        return new Promise(resolve => {
            const audio = new Audio(url);

            const onEnd = () => resolve();
            audio.addEventListener("ended", onEnd);
            audio.addEventListener("error", onEnd);

            audio.play()

            // Make skipping instant
            this._currentSkipResolver = () => {
                audio.pause();
                audio.currentTime = audio.duration;
                resolve();
            };
        }).finally(() => {
            this._currentSkipResolver = null;
        });
    }

    // Skip ONLY the current instruction
    skip() {
        this.skipCurrent = true;
        if (this._currentSkipResolver) this._currentSkipResolver();
    }

    // Skip EVERYTHING (jump to end)
    skipToEnd() {
        this.skipAll = true;
        this.skipCurrent = true;
        if (this._currentSkipResolver) this._currentSkipResolver();
    }

}
