export class InstructionSequenceRunner {

    constructor(view, instructions, domElements, audioContext) {
        this.view = view;
        this.instructions = instructions;
        this.domElements = domElements;
        this.audioContext = audioContext;
        this.skipCurrent = false;
        this.skipAll = false;
        this._currentSkipResolver = null;

    }

    getEl(id) {
        return document.getElementById(id);
    }

    async run() {
        this.skipAll = false;
        for (let i = 0; i < this.instructions.length; i++) {
            const instruction = this.instructions[i];
            console.log("Showing instruction step", i + 1, "of", this.instructions.length, ": ", instruction);
            if (!this.skipAll) this.skipCurrent = false;
            if (this.skipAll) this.skipCurrent = true;

            await this.executeInstruction(instruction);

            if (this.skipCurrent) continue; // immediately go to next instruction

            const delay = instruction.delayAfter;
            if (delay > 0) {
                await this.sleep(delay);
            }
            console.log("Instruction step complete");
        }
        console.log("Instruction sequence complete");
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
        const { action, element, url, data } = instr;
        console.log(
            "Executing",
            action,
            ...(element != null ? ["on element", element] : []),
            ...(url != null ? ["with url", url] : []),
            ...(data != null ? ["with data", data] : []),
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

            case "showFaded":
                this.domElements.showFaded(this.getEl(element));
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

            case "setText":
                this.domElements.setText(this.getEl(element), data);
                break;

            case "clickButton":
                const el1 = this.getEl(element);
                el1.focus();
                el1.click();
                setTimeout(() => {
                    el1.blur();
                }, 1000);
                break;

            case "setButtonSoundOnce":
                const self = this;
                const el2 = this.getEl(element);
                const u = url;
                this.domElements.setButtonAudioCallback(
                    el2,
                    async function() {
                        if (u) {
                            await self.playSound(u);
                        }
                        self.domElements.setButtonAudioCallback(el2, null);
                    }
                )
                break;

            case "setRepeatButtonDestination":
                this.view.setRepeatDestination(parseInt(data));
                break;

            case "setMarker":
                this.domElements.setMarker(this.getEl(element), parseInt(data));
                break;

            case "addText":
                this.domElements.addText(this.getEl(element), data);
                break;

            case "removeText":
                this.domElements.removeText(this.getEl(element), parseInt(data) || 1);
                break;

            default:
                throw new Error("Unknown action: " + action);
        }
    }
    
    async playSound(url) {
        if (this.skipCurrent) return;
    
        const context = this.audioContext;
    
        try {
            // Fetch audio data
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await context.decodeAudioData(arrayBuffer);
    
            const source = context.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(context.destination);
    
            let resolved = false;
    
            // Setup skip resolver
            this._currentSkipResolver = () => {
                if (!resolved) {
                    source.stop();
                    resolved = true;
                }
            };
    
            source.start();
    
            // Wait until finished or skipped
            await new Promise((resolve) => {
                source.onended = () => {
                    if (!resolved) resolved = true;
                    resolve();
                };
            });
    
        } finally {
            this._currentSkipResolver = null;
        }
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
