export class InstructionSequenceRunner {

    constructor(view, instructions, domElements) {
        this.view = view;
        this.instructions = instructions;
        this.domElements = domElements;
        this.skipCurrent = false;
        this.skipAll = false;
        this._currentSkipResolver = null;

        // Reuse one audio element (better for iOS Safari)
        this._audio = new Audio();
        this._audio.preload = "auto";
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
                this.getEl(element).click();
                break;

            case "setButtonSoundOnce":
                const self = this;
                const el = this.getEl(element);
                const u = url;
                this.domElements.setButtonAudioCallback(
                    el,
                    async function() {
                        if (u) {
                            await self.playSound(u);
                        }
                        self.domElements.setButtonAudioCallback(el, null);
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

    playSound(url) {
        if (this.skipCurrent) return Promise.resolve();

        return new Promise(resolve => {
            const audio = this._audio;
    
            // Stop anything currently playing
            audio.pause();
    
            // Reset and set new source
            audio.currentTime = 0;
            audio.src = url;
    
            const cleanup = () => {
                audio.removeEventListener("ended", onEnd);
                audio.removeEventListener("error", onEnd);
            };
    
            const onEnd = () => {
                cleanup();
                resolve();
            };
    
            audio.addEventListener("ended", onEnd);
            audio.addEventListener("error", onEnd);

            audio.play()

            // Make skipping instant
            this._currentSkipResolver = () => {
                cleanup();
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
