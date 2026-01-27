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
                img.style.maxWidth = "300px";
                img.style.display = "block";
                img.style.margin = "1rem 0";
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
                playBtn.textContent = "▶ Afspil lyd";
                playBtn.className = "btn btn-secondary";
                playBtn.style.margin = "1rem 0";

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

    showQuestionFreeText(placeholder = "", sound = null, image_url = null) {
        const wrapper = document.createElement("div");
        wrapper.className = "mb-3";

        const input = document.createElement("input");
        input.type = "text";
        input.className = "form-control";
        input.placeholder = placeholder;

        wrapper.append(input);
        this.choicesEl.append(wrapper);

        return input;
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
        this.nextBtn.style.display = show ? "inline-block" : "none";
    }

    setNextButtonListener(listener) {
        this.nextBtn = this._setButtonListener(this.nextBtn, listener);
    }

    clearQuestionChoices() {
        this.choicesEl.innerHTML = "";
    }

    showQuestionChoice(text, sound, imageUrl) {
        console.log("showQuestionChoice", text, sound, imageUrl);
        const btn = document.createElement("button");
        if (text) {
            btn.textContent = text;
        }
        // TODO: render sound and image
        btn.className = "btn btn-outline-primary";
        this.choicesEl.append(btn);
        return btn;
    }

}

export class IndividualTestDomElements extends TestDomElements {

    constructor() {
        super();
    }

}
