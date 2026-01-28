class TestDomElements {

    instructionsSoundEl;
    introTextEl;
    questionTitleEl;
    questionChallengeEl;

    constructor() {
        this.instructionsSoundEl = document.querySelector("#instructions-sound");
        this.introTextEl = document.querySelector("#instructions-text");
        this.questionTitleEl = document.querySelector("#question-title");
        this.questionChallengeEl = document.querySelector("#question-challenge");

        if (!this.instructionsSoundEl || !this.introTextEl || !this.questionTitleEl || !this.questionChallengeEl) {
            throw new Error("Required DOM elements missing");
        }
    }

    showInstructions(text, audio) {
        if (text) {
            this.introTextEl.textContent = text;
        }
        if (audio) {
            const soundSource = document.createElement("source");
            soundSource.src = audio;
            soundSource.type = "audio/mpeg";
            this.instructionsSoundEl.append(soundSource);
        }
    }

    hideInstructions() {
        this.introTextEl.textContent = "";
        this.instructionsSoundEl.innerHTML = "";
    }

    _setButtonListener(button, listener) {
        // Removes existing listeners and sets a new one.
        // by just replacing the whole thing
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        newButton.addEventListener("click", listener);
        return newButton;
    }

    showQuestionTitle(text) {
        this.questionTitleEl.textContent = text || "";
    }
    showQuestionChallenge(text, sound, imageUrl) {
        let img = document.querySelector("#challenge-image");
        if (imageUrl) {
            if (!img) {
                img = document.createElement("img");
                img.id = "challenge-image";
                this.questionChallengeEl.append(img);
            }
            img.src = imageUrl;
        } else {
            if (img) {
                img.remove();
            }
        }
        if (text) {
            this.questionChallengeEl.innerHTML = text;
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
                playBtn.innerHTML = '<span class="material-icons">volume_up</span>';
                playBtn.className = "btn sound-btn";

                const insertAfter = img || this.questionChallengeEl;
                insertAfter.after(playBtn);
            }

            playBtn.onclick = () => {
                audio.currentTime = 0; // restart every time
                audio.play();
            };
        } else {
            if (playBtn) playBtn.remove();
            if (audio) audio.remove();
        }
    }

    showQuestionFreeText(placeholder = "", sound = null, image_url = null, listener = null) {
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
        eraseBtn.innerHTML = '<span class="material-icons">backspace</span>';
        eraseBtn.className = "btn erase-btn";
        updateEraseBtnState();
    
        eraseBtn.addEventListener("click", () => {
            displayField.textContent = displayField.textContent.slice(0, -1);
            updateEraseBtnState();
            if (listener) listener({ target: { value: displayField.textContent } });
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
                btn.addEventListener("click", () => {
                    displayField.textContent += letter;
                    updateEraseBtnState();
                    if (listener) listener({ target: { value: displayField.textContent } });
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

    startPracticeButton;
    startQuestionsButton;
    choicesEl;
    nextBtn;

    constructor() {
        super();
        this.startPracticeButton = document.querySelector("#start-practice");
        this.startQuestionsButton = document.querySelector("#start-questions");
        this.choicesEl = document.querySelector("#choices");
        this.nextBtn = document.querySelector("#next");

        if (!this.startPracticeButton || !this.startQuestionsButton || !this.choicesEl || !this.nextBtn) {
            throw new Error("Required DOM elements missing");
        }
    }

    showInstructions(text, audio) {
        super.showInstructions(text, audio);
        this.startPracticeButton.style.display = "inline-block";
        this.startQuestionsButton.style.display = "inline-block";
    }

    togglePracticeButton(show) {
        this.startPracticeButton.style.display = show ? "inline-block" : "none";
    }

    toggleQuestionsButton(show) {
        this.startQuestionsButton.style.display = show ? "inline-block" : "none";
    }

    setPracticeButtonListener(listener) {
        this.startPracticeButton = this._setButtonListener(this.startPracticeButton, listener);
    }

    setQuestionsButtonListener(listener) {
        this.startQuestionsButton = this._setButtonListener(this.startQuestionsButton, listener);
    }

    toggleNextButton(show) {
        this.nextBtn.style.display = show ? "block" : "none";
    }

    setNextButtonListener(listener) {
        this.nextBtn = this._setButtonListener(this.nextBtn, listener);
    }

    clearQuestionChoices() {
        this.choicesEl.innerHTML = "";
    }

    showQuestionChoice(text, sound, imageUrl, listener) {
        console.log("showQuestionChoice", text, sound, imageUrl);
        const btn = document.createElement("button");
        if (text) {
            btn.textContent = text;
        }
        // TODO: render sound and image
        btn.className = "btn btn-outline-primary";
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

    constructor() {
        super();
    }

}
