class TestDomElements {

    instructionsSoundEl;
    studentHeaderEl;
    questionChallengeEl;
    endSummaryButton;
    summaryTable;

    constructor() {
        this.instructionsSoundEl = document.querySelector("#instructions-sound");
        this.studentHeaderEl = document.querySelector("#student-header");
        this.questionChallengeEl = document.querySelector("#question-challenge");
        this.endSummaryButton = document.querySelector("#end-summary");
        this.startSummaryButton = document.querySelector("#start-summary");
        this.startTestPartButton = document.querySelector("#start-testpart");
        this.summaryTable = document.querySelector("#summary-table");
        this.overlay = document.getElementById("fade-overlay");
        this.testIntro = document.querySelector("#test-intro");
        this.testPartIntro = document.querySelector("#testpart-intro");
        this.testPartIntroText = document.querySelector("#testpart-intro-text");
        this.testPartIntroImage = document.querySelector("#testpart-intro-image");
        this.testSummary = document.querySelector("#test-summary");
        this.testContainer = document.querySelector("#test-container");
        this.skipInstructionButton = document.querySelector("#skip-instruction");
        this.skipAllInstructionsButton = document.querySelector("#skip-all-instructions");
    }

    makeButtonAngry(buttonId) {
        const btn = document.getElementById(buttonId);

        // Restart animation if it’s already running
        btn.classList.remove("angry-btn");
        void btn.offsetWidth; // force reflow
        btn.classList.add("angry-btn");

        // Remove class after animation ends
        setTimeout(() => {
            btn.classList.remove("angry-btn");
        }, 650);
    }

    makeButtonHappy(buttonId) {
        const btn = document.getElementById(buttonId);

        // Restart animation if it’s already running
        btn.classList.remove("happy-btn");
        void btn.offsetWidth; // force reflow
        btn.classList.add("happy-btn");

        // Remove class after animation ends
        setTimeout(() => {
            btn.classList.remove("happy-btn");
        }, 650);
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


    showSummary(parts) {
        this.testSummary.style.display = "flex";

        parts.forEach(partname => {
            const row = document.createElement('tr');
            const td = document.createElement('td');
            td.textContent = partname;
            row.appendChild(td);
            this.summaryTable.appendChild(row);
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

    setEndSummaryButtonListener(listener, text) {
        this.endSummaryButton = this._setButtonListener(this.endSummaryButton, listener);
        this.endSummaryButton.innerHTML = text;
    }
    setStartSummaryButtonListener(listener) {
        this.startSummaryButton = this._setButtonListener(this.startSummaryButton, listener);
    }
    setStartTestPartButtonListener(listener) {
        this.startTestPartButton = this._setButtonListener(this.startTestPartButton, listener);
    }

    showElement(el) {
        el.style.visibility = "visible";
    }

    hideElement(el) {
        el.style.visibility = "hidden";
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
    
    highlight(el) {
        el.classList.add("highlight");
        setTimeout(() => el.classList.remove("highlight"), 1500);
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
            btn.disabled = inputLocked;
        });
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
    
    _setButtonListener(button, listener) {
        if (button._clickHandler) {
            button.removeEventListener("click", button._clickHandler);
        }
    
        button._clickHandler = listener;
        button.addEventListener("click", listener);

        return button;
    }

    setStudentHeader(html) {
        this.studentHeaderEl.innerHTML = html;
        this.studentHeaderEl.style.display = "";
    }

    hideStudentHeader() {
        this.studentHeaderEl.style.display = "none";
    }

    setTestPartIntroText(text) {
        this.testPartIntroText.textContent = text;
    }

    hideTestPartIntroImage() {
        this.testPartIntroImage.style.display = "none";
    }

    showTestPartIntroImage() {
        this.testPartIntroImage.style.display = "flex";
    }

    showQuestionChallenge(text, sound, imageUrl) {
        if (!text && !sound && !imageUrl) {
            this.questionChallengeEl.innerHTML = "";
        }
        let img = document.querySelector("#challenge-image");
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
        let textEl = document.querySelector("#challenge-text");
        if (text) {
            if (!textEl) {
                textEl = document.createElement("div");
                textEl.id = "challenge-text";
                this.questionChallengeEl.append(textEl);
            }
            textEl.innerHTML = text;
        } else {
            if (textEl) {
                textEl.remove();
            }
        }

        let playBtn = document.querySelector("#challenge-sound-btn");
        let audio = document.querySelector("#challenge-audio");

        if (sound) {
            if (!audio) {
                audio = document.createElement("audio");
                audio.id = "challenge-audio";
                audio.preload = "none";
                audio.style.display = "none"; // hidden audio element
                document.body.appendChild(audio);
            }

            audio.src = sound;
            audio.load();

            if (!playBtn) {
                playBtn = document.createElement("button");
                playBtn.id = "challenge-sound-btn";
                playBtn.innerHTML = '<i class="ph ph-speaker-simple-high"></i>';
                playBtn.className = "btn sound-btn";

                const insertAfter = img || this.questionChallengeEl;
                insertAfter.after(playBtn);
            }
            playBtn.classList.add("pulse");
            playBtn.onclick = () => {
                audio.currentTime = 0; // restart every time
                audio.play();
                playBtn.classList.remove("pulse");

                const letterBtns = document.querySelectorAll(".letter-btn");
                letterBtns.forEach(b => b.disabled = false);

            };
        } else {
            if (playBtn) playBtn.remove();
            if (audio) audio.remove();
        }
    }

    showQuestionFreeText(listener) {
        // Shows a free text field, as well as a screen-keyboard

        function updateEraseBtnState() {
            eraseBtn.disabled = displayField.textContent.length === 0;
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
    
        const displayField = document.createElement("div");
        displayField.className = "form-control display-field";
    
        // --- Erase button ---
        const eraseBtn = document.createElement("button");
        eraseBtn.innerHTML = '<i class="ph ph-backspace"></i>';
        eraseBtn.className = "btn erase-btn";
        updateEraseBtnState();
    
        eraseBtn.addEventListener("click", () => {
            displayField.textContent = displayField.textContent.slice(0, -1);
            updateEraseBtnState();
            listener({ target: { value: displayField.textContent } });
        });
    
        textFieldWrapper.append(displayField, eraseBtn);
        wrapper.append(textFieldWrapper);
    
        // --- Letter buttons ---
        buttonRows.forEach(rowLetters => {
            const rowDiv = document.createElement("div");
            rowDiv.className = "letter-row";
            rowLetters.forEach(letter => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "btn letter-btn";
                btn.textContent = letter;
                btn.disabled = true;
                btn.addEventListener("click", () => {
                    displayField.textContent += letter;
                    updateEraseBtnState();
                    listener({ target: { value: displayField.textContent } });
                });
                rowDiv.appendChild(btn);
            });
            wrapper.insertBefore(rowDiv, textFieldWrapper); // above display
        });
    
        this.choicesEl.append(wrapper);
    
        return displayField;
    }
}

export class GroupTestDomElements extends TestDomElements {

    reminderSoundEl;
    choicesEl;
    nextBtn;

    constructor() {
        super();
        this.reminderSoundEl = document.querySelector("#reminder-sound");
        this.choicesEl = document.querySelector("#choices");
        this.nextBtn = document.querySelector("#next");
    }

    showSummary(parts) {
        super.showSummary(parts);
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


    setNextButtonListener(listener) {
        this.nextBtn = this._setButtonListener(this.nextBtn, listener);
    }

    clearQuestionChoices() {
        this.choicesEl.innerHTML = "";
    }

    showQuestionChoice(answer, listener) {
        const text = answer.resourceText;
        const sound = answer.resourceSoundUrl;
        const imageUrl = answer.resourceImageUrl;
        console.log("showQuestionChoice", text, sound, imageUrl);
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
        button.classList.toggle("btn-primary", selected);
        button.classList.toggle("btn-outline-primary", !selected);
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
