import { getCursorIndex, serverOnline } from "./utils.js";
import { assetCache } from "./cache.js";
import { setResponsiveFontSize } from "./utils.js";

class TestDomElements {
    instructionsSoundEl;
    studentHeaderEl;
    questionChallengeEl;
    endSummaryButton;
    reminderSoundEl;
    summaryContainer;
    nextBtn;

    constructor() {
        this.instructionsSoundEl = document.querySelector("#instructions-sound");
        this.studentHeaderEl = document.querySelector("#student-header");
        this.questionChallengeEl = document.querySelector("#question-challenge");
        this.endSummaryButton = document.querySelector("#end-summary");
        this.endSoundCalibrationButton = document.querySelector(
            "#end-sound-calibration",
        );
        this.endBreakButton = document.querySelector("#end-break");
        this.endIntroButton = document.querySelector("#end-intro");
        this.endTestPartOutroButton = document.querySelector("#end-testpart-outro");
        this.summaryContainer = document.querySelector("#summary-container");
        this.summaryScrollControls = document.querySelector("#summary-scroll-controls");
        this.scrollSummaryUpArrow = document.getElementById("scroll-summary-up");
        this.scrollSummaryDownArrow = document.getElementById("scroll-summary-down");
        this.nextBtn = document.querySelector("#next");
        this.overlay = document.getElementById("fade-overlay");
        this.reminderSoundEl = document.querySelector("#reminder-sound");
        this.testIntro = document.querySelector("#test-intro");
        this.testPartOutro = document.querySelector("#testpart-outro");
        this.testExit = document.querySelector("#test-exit");
        this.logOutButton = document.querySelector("#log-out");
        this.summaryLogOutButton = document.querySelector("#summary-log-out");
        this.testPartOutroText = document.querySelector("#testpart-outro-text");
        this.testPartOutroImage = document.querySelector("#testpart-outro-image");
        this.testSummary = document.querySelector("#test-summary");
        this.testSoundCalibration = document.querySelector("#test-sound-calibration");
        this.testBreak = document.querySelector("#test-break");
        this.testContainer = document.querySelector("#test-container");
        this.skipInstructionButton = document.querySelector("#skip-instruction");
        this.skipAllInstructionsButton = document.querySelector(
            "#skip-all-instructions",
        );
        this.skipSoundCalibrationButton = document.querySelector(
            "#skip-sound-calibration",
        );
        this.skipSummaryButton = document.querySelector("#skip-summary");
        this.repeatBtn = document.querySelector("#repeat");
        this.soundCalibrationAnimation = document.querySelector(
            "#sound-calibration-animation",
        );
        this.testFinishedRow = document.querySelector("#test-finished-row");
        this.speakerIcon = document.querySelector("#speaker");

        this.currentAudioSource = null;
        this.inputLocked = false;
    }

    setBodyBackground(color) {
        document.documentElement.style.setProperty("--bs-body-bg", color);
    }

    resetBodyBackground() {
        document.documentElement.style.removeProperty("--bs-body-bg");
    }
    updateSummaryArrows() {
        const { scrollTop, scrollHeight, clientHeight } = this.summaryContainer;

        const isAtTop = scrollTop <= 0;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

        if (isAtTop) {
            this.scrollSummaryUpArrow.classList.add("disabled");
        } else {
            this.scrollSummaryUpArrow.classList.remove("disabled");
        }

        if (isAtBottom) {
            this.scrollSummaryDownArrow.classList.add("disabled");
        } else {
            this.scrollSummaryDownArrow.classList.remove("disabled");
        }

        this.summaryContainer.classList.toggle("at-top", isAtTop);
        this.summaryContainer.classList.toggle("at-bottom", isAtBottom);

        if (scrollHeight <= clientHeight) {
            this.summaryContainer.classList.add("no-mask");
            this.summaryScrollControls.style.display = "none";
        } else {
            this.summaryContainer.classList.remove("no-mask");
            this.summaryScrollControls.style.display = "flex";
        }
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
        this.markButtonPress(buttonId, "angry-btn");
    }

    makeButtonHappy(buttonId) {
        this.markButtonPress(buttonId, "happy-btn");
    }

    makeButtonGlow(buttonId) {
        this.markButtonPress(buttonId, "pressed-btn");
    }

    fadeScreenOverlay() {
        // Immediately hide all content on the screen
        this.overlay.style.transition = "none";
        this.overlay.style.opacity = 1;

        // Fade content in gradually
        requestAnimationFrame(() => {
            setTimeout(() => {
                this.overlay.style.transition = "opacity 700ms ease";
                this.overlay.style.opacity = 0;
            }, 200); // Pause 200 miliseconds before starting the fade
        });
    }

    toggleBodyClass(className, show) {
        document.body.classList.toggle(className, show);
    }

    showSoundCalibration() {
        this.testSoundCalibration.style.display = "flex";

        if (this.skipSoundCalibrationButton) {
            this.skipSoundCalibrationButton.style.display = "flex";
        }
    }

    hideSoundCalibration() {
        this.testSoundCalibration.style.display = "none";
        if (this.skipSoundCalibrationButton) {
            this.skipSoundCalibrationButton.style.display = "none";
        }
    }

    showTestBreak() {
        this.testBreak.style.display = "flex";
    }
    hideTestBreak() {
        this.testBreak.style.display = "none";
    }

    showSoundCalibrationAnimation() {
        this.showElement(this.soundCalibrationAnimation);
    }

    hideSoundCalibrationAnimation() {
        this.hideElement(this.soundCalibrationAnimation);
    }

    stopSoundCalibrationAnimation() {
        this.soundCalibrationAnimation.src = assetCache.fetch(
            "/static/images/talking_face.png",
        );
    }
    startSoundCalibrationAnimation() {
        this.soundCalibrationAnimation.src = assetCache.fetch(
            "/static/images/talking_face.gif",
        );
    }

    async setLogOutButtonListener(buttonEl) {
        this._setButtonListener(buttonEl, () => {
            window.location.href = "/logout";
        });

        const isOnline = await serverOnline();
        if (!isOnline) {
            buttonEl.style.visibility = "hidden";
        }
    }

    async showSummary(parts, student, complete = false) {
        this.testSummary.style.display = "flex";
        this.summaryContainer.innerHTML = "";

        if (complete) {
            await this.setLogOutButtonListener(this.summaryLogOutButton);

            this.testFinishedRow.style.display = "flex";
            this.endSummaryButton.style.display = "none";
        }

        if (this.skipSummaryButton && !complete) {
            this.skipSummaryButton.style.display = "flex";
        }

        console.log("showSummary", arguments);

        parts.forEach((part) => {
            const block = document.createElement("div");
            block.classList.add("summary-block");

            // Make the block a flex container so we can push the image to the right
            block.style.display = "flex";
            block.style.alignItems = "center"; // vertically center text and image
            block.style.justifyContent = "space-between"; // ensures image stays on the right

            // Container for text so the image is separate
            const textContainer = document.createElement("div");

            if (part.completedByStudent(student) || complete) {
                textContainer.innerHTML =
                    part.name +
                    ' <span class="checkmark"><i class="ph-fill ph-check-fat"></i></span>';
            } else {
                textContainer.innerHTML = part.name;
            }

            // Create image element
            const img = document.createElement("img");
            img.src = part.image;
            img.alt = "TestPart icon";
            img.style.height = "50px";

            // Append text and image to block
            block.appendChild(textContainer);
            block.appendChild(img);

            this.summaryContainer.appendChild(block);
        });

        const scrollAmount = 100;

        this.scrollSummaryUpArrow.addEventListener("click", () => {
            this.summaryContainer.scrollBy({
                top: -scrollAmount,
                behavior: "smooth",
            });
        });

        this.scrollSummaryDownArrow.addEventListener("click", () => {
            this.summaryContainer.scrollBy({
                top: scrollAmount,
                behavior: "smooth",
            });
        });

        this.summaryContainer.addEventListener("scroll", () =>
            this.updateSummaryArrows(),
        );

        // Update initial state
        requestAnimationFrame(() => {
            setTimeout(() => {
                this.updateSummaryArrows();
            }, 0);
        });
    }

    hideSummary() {
        this.testSummary.style.display = "none";
        if (this.skipSummaryButton) {
            this.skipSummaryButton.style.display = "none";
        }
    }

    hideTestContainer() {
        this.testContainer.style.display = "none";
    }

    showTestContainer() {
        this.testContainer.style.display = "flex";
    }

    async showTestExit() {
        this.testExit.style.display = "flex";
        await this.setLogOutButtonListener(this.logOutButton);
    }

    hideIntro() {
        this.testIntro.style.display = "none";
    }

    hideTestPartOutro() {
        this.testPartOutro.style.display = "none";
    }

    showTestPartOutro() {
        this.testPartOutro.style.display = "flex";
    }

    toggleNextButton(show, alwaysVisible = false) {
        this.nextBtn.style.visibility = show || alwaysVisible ? "visible" : "hidden";

        if (show) {
            this.enableNextButton();
        } else {
            this.disableNextButton();
        }
    }

    toggleRepeatButton(show) {
        if (show) {
            this.showElement(this.repeatBtn);
        } else {
            this.hideElement(this.repeatBtn);
        }
    }

    disableNextButton() {
        this.nextBtn.style.transition = "";
        this.nextBtn.style.opacity = "";
        this.nextBtn.disabled = true;
    }

    enableNextButton() {
        this.nextBtn.disabled = false;
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

    setRepeatButtonListener(listener) {
        if (this.repeatBtn) {
            this._setButtonListener(this.repeatBtn, listener);
        }
    }

    showElement(el) {
        if (el) {
            if (el.dataset.hideDisplay === "true") {
                el.style.display = "block";
                el.style.visibility = "visible";
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
        el.style.transition = "opacity 1s";
        requestAnimationFrame(() => {
            el.style.opacity = 1;
        });
    }

    fadeOut(el) {
        el.style.transition = "opacity 1s";
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
        setTimeout(() => el.classList.remove("highlight"), 2000);
    }

    explicitHighlight(el) {
        // A more explicit version of "highlight". It takes a bit longer and the element
        // grows larger than it does during a regular highlight
        el.classList.add("highlight-explicit");
        setTimeout(() => el.classList.remove("highlight-explicit"), 2000);
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
        this.setMarker(el, position + text.length);
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

    async waitForClick(el) {
        el.classList.add("pulse");

        return new Promise((resolve) => {
            const handler = async () => {
                el.removeEventListener("click", handler);
                el.classList.remove("pulse");
                await el._busyPromise;
                resolve();
            };
            el.addEventListener("click", handler);
        });
    }

    lockInput() {
        this._updateInputState(true);
    }

    unlockInput() {
        this._updateInputState(false);
    }

    _updateInputState(inputLocked) {
        this.inputLocked = inputLocked;
        const buttons = document.querySelectorAll("button:not(.debug-button)");
        buttons.forEach((btn) => {
            if (inputLocked) {
                btn.style.pointerEvents = "none"; // disables clicks
                btn.tabIndex = -1; // skip focus in tabbing
            } else {
                btn.style.pointerEvents = ""; // restore click
                btn.tabIndex = 0; // restore tab focus
            }
        });
        const inputs = document.querySelectorAll("input:not(.debug-input)");
        inputs.forEach((input) => {
            input.readOnly = inputLocked;
            if (inputLocked) {
                input.style.pointerEvents = "none";
                input.tabIndex = -1;
                input.setAttribute("inert", "");
            } else {
                input.style.pointerEvents = "";
                input.removeAttribute("tabindex");
                input.removeAttribute("inert");
            }
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
        if (!button) {
            return;
        }
        if (button._clickHandler) {
            button.removeEventListener("click", button._clickHandler);
        }
        button._listener = listener;
        button._clickHandler = async function () {
            if (button.audioCallback) {
                await button.audioCallback();
            }
            button._listener();
        };
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

    setTestPartOutroText(html) {
        this.testPartOutroText.innerHTML = html;
    }

    hideTestPartOutroImage() {
        this.testPartOutroImage.style.display = "none";
    }

    showTestPartOutroImage() {
        this.testPartOutroImage.style.display = "flex";
    }

    hideChallengeImage() {
        const img = document.querySelector("#challenge-image");
        if (img) {
            img.style.opacity = 0;
        }
    }

    _insert(parent, child, after, before) {
        // Given lists of elements that `child` should be inserted after and before,
        // insert `child` into `parent` in the correct place
        const childrenList = Array.from(parent.children);
        if (after && after.length > 0) {
            const afterIndexes = after
                .filter((a) => a != null)
                .map((a) => childrenList.indexOf(a))
                .filter((i) => i >= 0);
            if (afterIndexes.length) {
                let last = childrenList[Math.max(...afterIndexes)];
                if (last && last.nextSibling) {
                    parent.insertBefore(child, last.nextSibling);
                    return;
                }
            }
        } else if (before && before.length > 0) {
            const beforeIndexes = before
                .filter((a) => a != null)
                .map((a) => childrenList.indexOf(a))
                .filter((i) => i >= 0);
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
            this.questionChallengeEl.style.display = "none";
        } else {
            this.questionChallengeEl.style.display = "flex";
        }
        let img = document.querySelector("#challenge-image");
        let textEl = document.querySelector("#challenge-text");
        let playBtn = document.querySelector("#challenge-sound-btn");
        this.questionChallengeEl.style.opacity = 1;
        if (imageUrl) {
            if (!img) {
                img = document.createElement("img");
                img.id = "challenge-image";
                this._insert(this.questionChallengeEl, img, null, [textEl]);
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
            textEl.style.opacity = 1;
            if (text.length === 1) {
                textEl.style.fontSize = "120px";
            } else if (text.includes(" ")) {
                textEl.style.fontSize = "32px";
            } else {
                if (imageUrl) {
                    textEl.style.fontSize = "32px";
                } else {
                    textEl.style.fontSize = "72px";
                }
            }
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

            playBtn.onclick = async () => {
                if (isPlaying) return; // prevent double-clicks
                isPlaying = true;
                playBtn.classList.remove("pulse");
                playBtn.classList.add("playing");

                await this.playSound(sound, audioContext);

                isPlaying = false;
                playBtn.classList.remove("playing");

                const letterBtns = document.querySelectorAll(".letter-btn");
                letterBtns.forEach((b) => (b.disabled = false));

                this.choicesEl
                    .querySelectorAll("button")
                    .forEach((b) => (b.disabled = false));

                const displayField = document.querySelector(".display-field");
                if (displayField) {
                    displayField.disabled = false;
                }
            };
        }

        return {
            textEl: textEl,
            img: img,
            playBtn: playBtn,
        };
    }

    interruptSound() {
        if (this.currentAudioSource) {
            this.currentAudioSource.stop();
            this.currentAudioSource = null;
        }
    }

    async playSound(sound, audioContext, mode = "interrupt") {
        console.log("Playing", sound);
        if (mode === "drop" && this.currentAudioSource) {
            console.log("Something is already playing. Dropped ", sound);
            return;
        }

        if (mode === "interrupt") {
            // Stop whatever is playing right now.
            this.interruptSound();
        }

        // Fetch & decode audio
        const response = await fetch(assetCache.fetch(sound));
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Play
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        this.currentAudioSource = source;
        source.start();

        // Wait until finished
        await new Promise((resolve) => {
            source.onended = resolve;
        });

        // Only clear if this source is still the active one
        // (an "interrupt" call may have replaced it).
        if (this.currentAudioSource === source) {
            this.currentAudioSource = null;
        }
    }

    showQuestionFreeText(listener) {
        // Shows a free text field, as well as a screen-keyboard

        function updateEraseBtnState() {
            eraseBtn.disabled = displayField.value.length === 0;
        }

        const wrapper = document.createElement("div");
        wrapper.style.width = "90%";

        // --- Button rows ---
        const buttonRows = [
            ["a", "e", "f", "g", "i", "j"],
            ["k", "l", "m", "n", "o", "p"],
            ["q", "r", "s", "t", "u", "v"],
        ];

        // --- Display field (label-only feel) ---
        const textFieldWrapper = document.createElement("div");
        textFieldWrapper.style.display = "flex";
        textFieldWrapper.style.alignItems = "center";
        textFieldWrapper.style.gap = "20px";

        const displayField = document.createElement("input");
        displayField.className = "form-control display-field";
        displayField.id = "free-text-field";
        displayField.type = "text";
        displayField.inputMode = "none";
        displayField.disabled = true;

        displayField.addEventListener(
            "contextmenu",
            (e) => {
                e.preventDefault();
            },
            false,
        );

        displayField.addEventListener(
            "touchstart",
            (e) => {
                e.preventDefault(); // Kills the iPad menu before it can think
                displayField.focus();

                const touch = e.touches[0];
                const rect = displayField.getBoundingClientRect();

                // Calculate the horizontal offset of the tap relative to the text start
                const style = window.getComputedStyle(displayField);
                const paddingLeft = parseFloat(style.paddingLeft) || 0;
                const tapX = touch.clientX - rect.left - paddingLeft;

                // Find the character index
                const pos = getCursorIndex(displayField, tapX);

                displayField.setSelectionRange(pos, pos);
            },
            { passive: false },
        );
        displayField.addEventListener("keydown", (e) => e.preventDefault());
        displayField.addEventListener("keypress", (e) => e.preventDefault());

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
            this.makeButtonGlow(eraseBtn.id);
        });

        textFieldWrapper.append(displayField, eraseBtn);

        // --- Letter buttons ---
        const buttonsWrapper = document.createElement("div");
        buttonsWrapper.id = "free-text-buttons";
        buttonRows.forEach((rowLetters) => {
            const rowDiv = document.createElement("div");
            rowDiv.className = "letter-row";
            rowLetters.forEach((letter) => {
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
                    this.makeButtonGlow(btn.id);
                });
                rowDiv.appendChild(btn);
            });
            buttonsWrapper.append(rowDiv);
        });
        wrapper.append(buttonsWrapper); // below display
        wrapper.append(textFieldWrapper);

        this.choicesEl.append(wrapper);
        this.toggleNextButton(true);
        this.disableNextButton();

        return displayField;
    }
}

export class GroupTestDomElements extends TestDomElements {
    choicesEl;

    constructor() {
        super();
        this.choicesEl = document.querySelector("#choices");

        this.choicesElLeft = document.querySelector("#choices-left");
        this.choicesElRight = document.querySelector("#choices-right");
        this.multipleChoiceMatchContainer = document.querySelector(
            "#multiple-choice-match-container",
        );
    }

    toggleQuestionDisplay(state) {
        for (const el of [
            this.questionChallengeEl,
            this.choicesEl,
            this.multipleChoiceMatchContainer,
        ]) {
            el.style.display = state;
            if (state == "flex") {
                this.showElement(el);
            }
        }
    }

    clearQuestionChoices() {
        this.choicesEl.innerHTML = "";
        this.choicesEl.classList.remove("true-false-layout");
        this.choicesElLeft.innerHTML = "";
        this.choicesElRight.innerHTML = "";
    }

    showQuestionChoice(answer, listener, answerCount, container, squareButton = false) {
        const text = answer.resourceText;
        //const sound = answer.resourceSoundUrl;
        const imageUrl = answer.resourceImageUrl;
        const btn = document.createElement("button");
        btn.className = "btn btn-outline-primary";
        if (text) {
            if (text === "true") {
                btn.innerHTML = '<i class="ph-bold ph-check"></i>';
                btn.classList.remove("btn-outline-primary");
                btn.classList.add("btn-true-false");
                btn.classList.add("true");
                this.choicesEl.classList.add("true-false-layout");
            } else if (text === "false") {
                btn.innerHTML = '<i class="ph-bold ph-x"></i>';
                btn.classList.remove("btn-outline-primary");
                btn.classList.add("btn-true-false");
                btn.classList.add("false");
                this.choicesEl.classList.add("true-false-layout");
            } else {
                btn.textContent = text;
            }

            if (squareButton) {
                btn.style.fontSize = "72px";
            } else {
                setResponsiveFontSize(btn, 32);
            }
        }
        if (imageUrl) {
            const image = document.createElement("img");
            image.src = imageUrl;
            btn.append(image);
            btn.classList.add("square-btn");
        } else if (squareButton) {
            btn.classList.add("square-btn");
        }

        // TODO: render sound
        btn.id = answer.buttonId;

        container.append(btn);
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
