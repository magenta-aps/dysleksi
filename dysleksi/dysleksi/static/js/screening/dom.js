class TestDomElements {

    instructionsSoundEl;
    studentHeaderEl;
    questionChallengeEl;
    endSummaryButton;
    summaryContainer;
    nextBtn;

    constructor() {
        this.instructionsSoundEl = document.querySelector("#instructions-sound");
        this.studentHeaderEl = document.querySelector("#student-header");
        this.questionChallengeEl = document.querySelector("#question-challenge");
        this.endSummaryButton = document.querySelector("#end-summary");
        this.startSummaryButton = document.querySelector("#start-summary");
        this.startTestPartButton = document.querySelector("#start-testpart");
        this.summaryContainer = document.querySelector("#summary-container");
        this.nextBtn = document.querySelector("#next");
        this.overlay = document.getElementById("fade-overlay");
        this.testIntro = document.querySelector("#test-intro");
        this.testPartIntro = document.querySelector("#testpart-intro");
        this.testPartIntroText = document.querySelector("#testpart-intro-text");
        this.testPartIntroImage = document.querySelector("#testpart-intro-image");
        this.testSummary = document.querySelector("#test-summary");
        this.testContainer = document.querySelector("#test-container");
        this.skipInstructionButton = document.querySelector("#skip-instruction");
        this.skipAllInstructionsButton = document.querySelector("#skip-all-instructions");
        this.repeatBtn = document.querySelector("#repeat");
    }

    markButtonPress(buttonId, buttonClass) {
        const btn = document.getElementById(buttonId);

        // Restart animation if it’s already running
        btn.classList.remove(buttonClass);
        void btn.offsetWidth; // force reflow
        btn.classList.add(buttonClass);

        // Remove class after animation ends
        setTimeout(() => {
            btn.classList.remove(buttonClass);
        }, 650);
    }

    makeButtonAngry(buttonId) {
        this.markButtonPress(buttonId, "angry-btn")
    }

    makeButtonHappy(buttonId) {
        this.markButtonPress(buttonId, "happy-btn")
    }

    makeButtonGlow(buttonId) {
        this.markButtonPress(buttonId, "pressed-btn")
    }


    fadeScreenOverlay() {

        // Immediately hide all content on the screen
        this.overlay.style.transition = "none";
        this.overlay.style.opacity = 1;
    
        // Fade content in gradually
        requestAnimationFrame(() => {
            setTimeout(() => {
                this.overlay.style.transition = "opacity 200ms ease";
                this.overlay.style.opacity = 0;
            }, 200); // Pause 200 miliseconds before starting the fade
        });
    }


    toggleBodyClass(className, show) {
        document.body.classList.toggle(className, show);
    }

    showSummary(parts) {
        this.testSummary.style.display = "flex";
        console.log("showSummary", arguments);

        parts.forEach((part, index) => {
            const block = document.createElement('div');
            block.classList.add('summary-block');
    
            // Make the block a flex container so we can push the image to the right
            block.style.display = 'flex';
            block.style.alignItems = 'center'; // vertically center text and image
            block.style.justifyContent = 'space-between'; // ensures image stays on the right
    
            const numQuestions = part.questions.length;
            const partNumber = index + 1;
    
            // Normal part name text
            const nameText = document.createTextNode(part.name + ' ');

            // Container for text so the image is separate
            const textContainer = document.createElement('div');
            textContainer.appendChild(nameText);
    
            // Create image element
            const img = document.createElement('img');
            img.src = part.image;
            img.alt = "TestPart icon";
            img.style.height = "100%";
    
            // Append text and image to block
            block.appendChild(textContainer);
            block.appendChild(img);
    
            this.summaryContainer.appendChild(block);
        });
    }

    hideSummary() {
        this.testSummary.style.display = "none";
    }

    hideTestContainer() {
        this.testContainer.style.display = "none";
    }

    showTestContainer() {
        this.testContainer.style.display = "flex";
    }

    hideIntro() {
        this.testIntro.style.display = "none";
    }

    hideTestPartIntro() {
        this.testPartIntro.style.display = "none";
    }

    showTestPartIntro() {
        this.testPartIntro.style.display = "flex";
    }

    setEndSummaryButtonListener(listener) {
        this.endSummaryButton = this._setButtonListener(this.endSummaryButton, listener);
    }
    setStartSummaryButtonListener(listener) {
        this.startSummaryButton = this._setButtonListener(this.startSummaryButton, listener);
    }
    setStartTestPartButtonListener(listener) {
        this.startTestPartButton = this._setButtonListener(this.startTestPartButton, listener);
    }

    toggleNextButton(show) {
        this.nextBtn.style.visibility = show ? "visible" : "hidden";
    }

    toggleRepeatButton(show) {
        this.repeatBtn.style.visibility = show ? "visible" : "hidden";
    }

    disableNextButton() {
        this.nextBtn.style.transition = ""
        this.nextBtn.style.opacity = ""
        this.nextBtn.disabled = true;
    }
    
    enableNextButton() {
        this.nextBtn.disabled = false;
    }


    setNextButtonListener(listener) {
        this._setButtonListener(this.nextBtn, listener);
    }

    setRepeatButtonListener(listener) {
        if (this.repeatBtn) {
            this._setButtonListener(this.repeatBtn, listener);
        }
    }

    showElement(el) {
        if (el) {
            if (el.dataset.hideDisplay === "true") {
                el.style.display = "block";
            } else {
                el.style.visibility = "visible";
            }
        }
    }
    
    hideElement(el) {
        if (el) {
            if (el.dataset.hideDisplay === "true") {
                el.style.display = "none";
            } else {
                el.style.visibility = "hidden";
            }
        }
    }
    
    fadeIn(el) {
        el.style.transition = "opacity 0.5s";
        requestAnimationFrame(() => {
            el.style.opacity = 1;
        });
    }
    
    fadeOut(el) {
        el.style.transition = "opacity 0.5s";
        requestAnimationFrame(() => {
            el.style.opacity = 0.4;
        });
    }

    showFaded(el) {
        el.style.transition = "none";
        el.style.opacity = 0.4;
        setTimeout(() => {
            this.showElement(el);
        }, 1);
    }
    
    highlight(el) {
        el.classList.add("highlight");
        setTimeout(() => el.classList.remove("highlight"), 1500);
    }

    setText(el, text) {
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
            el.value = text;
        } else {
            el.textContent = text;
        }
    }

    addText(el, text) {
        const position = el.selectionStart;
        el.value = el.value.slice(0, position) + text + el.value.slice(position);
        this.setMarker(el,position + text.length);
    }
    removeText(el, count) {
        if (count === undefined) {
            count = 1;
        }
        const position = el.selectionStart;
        if (count > position) {
            count = position;
        }
        el.value = el.value.slice(0, position - count) + el.value.slice(position);
        this.setMarker(el, position - count);
    }

    setMarker(el, position) {
        el.focus();
        el.setSelectionRange(position, position);
    }

    lockInput() {
        this._updateInputState(true);
    }
    
    unlockInput() {
        this._updateInputState(false);
    }
    
    _updateInputState(inputLocked) {
        const buttons = document.querySelectorAll("button:not(.debug-button)");
        buttons.forEach(btn => {
            if (inputLocked) {
                btn.style.pointerEvents = "none";  // disables clicks
                btn.tabIndex = -1;                 // skip focus in tabbing
            } else {
                btn.style.pointerEvents = "";      // restore click
                btn.tabIndex = 0;                  // restore tab focus
            }
        });
        const inputs = document.querySelectorAll("input:not(.debug-input)");
        inputs.forEach(input => {
            input.readOnly = inputLocked;
        });
        this.toggleBodyClass("input-locked", inputLocked);
    }

    showInstructions(text, audio) {
        if (audio) {
            const soundSource = document.createElement("source");
            soundSource.src = audio;
            soundSource.type = "audio/mpeg";
            this.instructionsSoundEl.append(soundSource);
        }
    }

    hideInstructions() {
        this.studentHeaderEl.textContent = "";
        this.instructionsSoundEl.innerHTML = "";
    }
    
    setButtonAudioCallback(button, audioCallback) {
        button.audioCallback = audioCallback;
    }

    _setButtonListener(button, listener) {
        if (button._clickHandler) {
            button.removeEventListener("click", button._clickHandler);
        }
        button._listener = listener;
        button._clickHandler = async function() {
            if (button.audioCallback) {
                await button.audioCallback();
            }
            button._listener();
        }
        button.addEventListener("click", button._clickHandler);
        return button;
    }

    setStudentHeader(html) {
        this.studentHeaderEl.innerHTML = html;
        this.studentHeaderEl.style.display = "";
    }

    hideStudentHeader() {
        this.studentHeaderEl.style.display = "none";
    }

    setTestPartIntroText(html) {
        this.testPartIntroText.innerHTML = html;
    }

    hideTestPartIntroImage() {
        this.testPartIntroImage.style.display = "none";
    }

    showTestPartIntroImage() {
        this.testPartIntroImage.style.display = "flex";
    }

    hideChallengeImage() {
        const img = document.querySelector("#challenge-image");
        if (img){
            img.style.opacity=0
        }
    }

    _insert(parent, child, after, before) {
        // Given lists of elements that `child` should be inserted after and before,
        // insert `child` into `parent` in the correct place
        const childrenList = Array.from(parent.children);
        if (after && after.length > 0) {
            const afterIndexes = after.filter(a => a != null).map(a => childrenList.indexOf(a)).filter(i => i >= 0)
            if (afterIndexes.length) {
                let last = childrenList[Math.max(...afterIndexes)];
                if (last && last.nextSibling) {
                    parent.insertBefore(child, last.nextSibling);
                    return;
                }
            }
        } else if (before && before.length > 0) {
            const beforeIndexes = before.filter(a => a != null).map(a => childrenList.indexOf(a)).filter(i => i >= 0);
            if (beforeIndexes.length) {
                let first = childrenList[Math.min(...beforeIndexes)];
                parent.insertBefore(child, first);
                return;
            }
        }
        parent.appendChild(child);
    }

    showQuestionChallenge(text, sound, imageUrl, audioContext) {
        if (!text && !sound && !imageUrl) {
            this.questionChallengeEl.innerHTML = "";
        }
        let img = document.querySelector("#challenge-image");
        let textEl = document.querySelector("#challenge-text");
        let playBtn = document.querySelector("#challenge-sound-btn");
        this.questionChallengeEl.style.opacity = 1
        if (imageUrl) {
            if (!img) {
                img = document.createElement("img");
                img.id = "challenge-image";
                this.questionChallengeEl.append(img);
            }
            img.src = imageUrl;
            img.style.opacity = 1;
        } else {
            if (img) {
                img.remove();
            }
        }
        if (text) {
            if (!textEl) {
                textEl = document.createElement("div");
                textEl.id = "challenge-text";
                this._insert(this.questionChallengeEl, textEl, [img], [playBtn]);
            }
            textEl.innerHTML = text;
        } else {
            if (textEl) {
                textEl.remove();
            }
        }

        if (playBtn) playBtn.remove();

        if (sound && audioContext) {
            playBtn = document.createElement("button");
            playBtn.id = "challenge-sound-btn";
            playBtn.className = "btn sound-btn pulse";
            this._insert(this.questionChallengeEl, playBtn, [img, textEl], null);
    
            let isPlaying = false;
            let currentSource = null;

            playBtn.onclick = async () => {
                if (isPlaying) return; // prevent double-clicks
                isPlaying = true;
                playBtn.classList.remove("pulse");
                playBtn.classList.add("playing");

                await this.playSound(sound, currentSource, audioContext);

                isPlaying = false;
                playBtn.classList.remove("playing");

                const letterBtns = document.querySelectorAll(".letter-btn");
                letterBtns.forEach(b => b.disabled = false);
            };
        }

        return {
            textEl: textEl,
            img: img,
            playBtn: playBtn,
        }
    }

    async playSound(sound, currentSource, audioContext) {
        // Fetch & decode audio
        const response = await fetch(sound);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Play
        currentSource = audioContext.createBufferSource();
        currentSource.buffer = audioBuffer;
        currentSource.connect(audioContext.destination);
        currentSource.start();

        // Wait until finished
        await new Promise(resolve => {
            currentSource.onended = resolve;
        });
    }

    showQuestionFreeText(listener) {
        // Shows a free text field, as well as a screen-keyboard

        function updateEraseBtnState() {
            eraseBtn.disabled = displayField.value.length === 0;
        }

        const wrapper = document.createElement("div");
        wrapper.className = "mb-3";
    
        // --- Button rows ---
        const buttonRows = [
            ["a", "e", "f", "g", "i", "j"],
            ["k", "l", "m", "n", "o", "p"],
            ["q", "r", "s", "t", "u", "v"]
        ];
    
        // --- Display field (label-only feel) ---
        const textFieldWrapper = document.createElement("div");
        textFieldWrapper.style.display = "flex";           
        textFieldWrapper.style.alignItems = "center";     
        textFieldWrapper.style.gap = "0.5rem";            
    
        const displayField = document.createElement("input");
        displayField.className = "form-control display-field";
        displayField.id = "free-text-field";
        displayField.type = "text";
        displayField.inputMode = "none";

        displayField.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        }, false);
    
        // --- Erase button ---
        const eraseBtn = document.createElement("button");
        eraseBtn.innerHTML = '<i class="ph-fill ph-backspace"></i>';
        eraseBtn.className = "btn erase-btn";
        eraseBtn.id = "free-text-erase-btn";
        updateEraseBtnState();
    
        eraseBtn.addEventListener("click", () => {
            this.removeText(displayField, 1);
            updateEraseBtnState();
            listener({ target: { value: displayField.value } });
            this.makeButtonGlow(eraseBtn.id)
        });
    
        textFieldWrapper.append(displayField, eraseBtn);
        wrapper.append(textFieldWrapper);
    
        // --- Letter buttons ---
        const buttonsWrapper = document.createElement("div");
        buttonsWrapper.id = "free-text-buttons";
        buttonRows.forEach(rowLetters => {
            const rowDiv = document.createElement("div");
            rowDiv.className = "letter-row";
            rowLetters.forEach(letter => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "btn btn-outline-primary letter-btn";
                btn.textContent = letter;
                btn.disabled = true;
                btn.id = "free-text-" + letter;
                btn.addEventListener("click", () => {
                    this.addText(displayField, letter);
                    updateEraseBtnState();
                    listener({ target: { value: displayField.value } });
                    this.makeButtonGlow(btn.id)
                });
                rowDiv.appendChild(btn);
            });
            buttonsWrapper.append(rowDiv);
        });
        wrapper.append(buttonsWrapper); // below display
    
        this.choicesEl.append(wrapper);
    
        return displayField;
    }
}

export class GroupTestDomElements extends TestDomElements {

    reminderSoundEl;
    choicesEl;

    constructor() {
        super();
        this.reminderSoundEl = document.querySelector("#reminder-sound");
        this.choicesEl = document.querySelector("#choices");
    }

    showInstructions(text, audio) {
        super.showInstructions(text, audio);
    }

    toggleNextButton(show) {
        this.nextBtn.style.visibility = show ? "visible" : "hidden";
    }

    disableNextButton() {
        this.nextBtn.style.transition = ""
        this.nextBtn.style.opacity = ""
        this.nextBtn.disabled = true;
    }

    enableNextButton() {
        this.nextBtn.disabled = false;
    }

    toggleQuestionDisplay(state) {
        for (const el of [this.questionChallengeEl, this.choicesEl]) {
            el.style.display = state;
        }
    }

    clearNextButtonClass() {
        this.nextBtn.classList.remove("next-btn", "start-btn", "start-part-btn");
    }

    setNextButtonClass(cls) {
        this.clearNextButtonClass();
        this.nextBtn.classList.add(cls);
    }

    setNextButtonListener(listener) {
        this._setButtonListener(this.nextBtn, listener);
    }

    toggleRepeatButton(show) {
        if (show) {
            this.showElement(this.repeatBtn);
        } else {
            this.hideElement(this.repeatBtn);
        }
    }

    setRepeatButtonListener(listener) {
        if (this.repeatBtn) {
            this._setButtonListener(this.repeatBtn, listener);
        }
    }

    clearQuestionChoices() {
        this.choicesEl.innerHTML = "";
    }

    showQuestionChoice(answer, listener) {
        const text = answer.resourceText;
        const sound = answer.resourceSoundUrl;
        const imageUrl = answer.resourceImageUrl;
        const btn = document.createElement("button");
        if (text) {
            btn.textContent = text;
        }
        if (imageUrl) {
            const image = document.createElement("img");
            image.src = imageUrl;
            btn.append(image);
        }
        // TODO: render sound and image
        btn.className = "btn btn-outline-primary";
        btn.id = answer.buttonId;
        this.choicesEl.append(btn);
        if (listener) {
            btn.addEventListener("click", listener);
        }
        return btn;
    }

    toggleButtonSelected(button, selected) {
        button.classList.toggle("selected", selected);
    }

}

export class IndividualTestDomElements extends TestDomElements {

    audioIndicatorEl;

    constructor(audioIndicatorSelector = "#audio-indicator") {
        super();
        this.audioIndicatorEl = document.querySelector(audioIndicatorSelector);
    }

    toggleAudioIndicator(show) {
        this.audioIndicatorEl.style.display = show ? "block" : "none";
    }

}
