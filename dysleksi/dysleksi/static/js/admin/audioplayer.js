export function initialize_audio_players() {
    for (let player of document.getElementsByClassName("audio")) {
        const audioEl = player.getElementsByTagName("audio")[0];
        const playBtnEl = player.getElementsByTagName("i")[0];
        const uiEl = player;
        const durationEl = player.getElementsByTagName("span")[0];

        const addClickListener = () => {
            playBtnEl.addEventListener("click", (_evt) => {
                audioEl.play();
                uiEl.classList.add("playing");
                updateAudioDuration(audioEl, durationEl);
            });
        };

        console.log(audioEl.readyState);
        if (audioEl.readyState >= 4) {
            addClickListener();
        } else {
            audioEl.addEventListener("canplay", (_evt) => {
                addClickListener();
            });
        }

        // Restore normal look once audio is done playing
        audioEl.addEventListener("ended", (_evt) => {
            uiEl.classList.remove("playing");
        });

        if (audioEl.readyState >= 1) {
            updateAudioDuration(audioEl, durationEl);
        } else {
            // Wait until metadata is loaded before displaying duration
            audioEl.addEventListener("loadedmetadata", (_evt) => {
                updateAudioDuration(audioEl, durationEl);
            });
        }
    }
}

function updateAudioDuration(audioEl, durationEl) {
    const duration = audioEl.duration;
    if (!isNaN(duration) && isFinite(duration)) {
        durationEl.textContent = formatDuration(
            // Convert duration in seconds to `Date` (specified in milliseconds)
            new Date(duration * 1000),
        );
    } else {
        durationEl.textContent = "--:--";
    }
}

function formatDuration(duration) {
    const minutes = String(duration.getMinutes()).padStart(2, "0");
    const seconds = String(duration.getSeconds()).padStart(2, "0");
    return `${minutes}:${seconds}`;
}
