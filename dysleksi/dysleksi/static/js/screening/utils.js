import { getWebSocket } from "../ws.js";

let wakeLock = null;

export function startSession(studentIds) {
    const chatSocket = getWebSocket();

    chatSocket.addEventListener(
        "open",
        () => {
            chatSocket.send(
                JSON.stringify({
                    uuid: crypto.randomUUID(),
                    event: "session.start",
                    roomUrl: window.location.href.replace(window.location.origin, ""),
                    students: studentIds,
                }),
            );
        },
        { once: true },
    );

    chatSocket.addEventListener("message", (e) => {
        const data = JSON.parse(e.data);
        if (data.event === "student.ready") {
            refreshSession(studentIds);
        }
    });

    return chatSocket;
}

export function refreshSession(studentIds) {
    const chatSocket = getWebSocket();
    if (chatSocket.readyState === WebSocket.OPEN) {
        chatSocket.send(
            JSON.stringify({
                uuid: crypto.randomUUID(),
                event: "session.in_progress",
                roomUrl: window.location.href.replace(window.location.origin, ""),
                students: studentIds,
            }),
        );
    }
}

export function shuffleArray(array) {
    const arr = [...array]; // do not mutate original
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export async function requestWakeLock() {
    try {
        wakeLock = await navigator.wakeLock.request("screen");
        console.log("Screen wake lock active");

        wakeLock.addEventListener("release", () => {
            console.log("Screen wake lock released");
        });
    } catch (err) {
        console.error(`${err.name}, ${err.message}`);
    }
}

export function releaseWakeLock() {
    if (wakeLock) {
        wakeLock.release();
        wakeLock = null;
    }
}

let audioContext;

export function unlockAudioOnGesture() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioContext.state === "suspended") {
        const resume = () => {
            audioContext.resume();
            document.removeEventListener("click", resume);
        };
        document.addEventListener("click", resume, { once: true });
    }

    return audioContext;
}

export function calculateStudentProgress(test, currentPartIndex, currentQuestionIndex) {
    if (!test || !test.parts) return 0;

    let totalQuestions = 0;
    let questionsDone = 0;

    test.parts.forEach((part, index) => {
        const partMainCount = part.questions?.length || 0;

        // Total questions only counts main questions
        totalQuestions += partMainCount;

        if (index < currentPartIndex) {
            // All questions in previous parts are completed
            questionsDone += partMainCount;
        } else if (index === currentPartIndex) {
            // For current part, count only questions up to current index
            questionsDone += Math.min(currentQuestionIndex + 1, partMainCount);
        }
        // Questions in future parts are ignored
    });

    return totalQuestions > 0 ? (questionsDone / totalQuestions) * 100 : 0;
}

export function getCursorIndex(input, tapX) {
    const text = input.value;
    if (!text || tapX <= 0) return 0;

    // Create a hidden span to measure text exactly as it appears in the input
    const span = document.createElement("span");
    const style = window.getComputedStyle(input);

    // Copy essential styles to ensure measurement matches exactly
    span.style.font = style.font;
    span.style.letterSpacing = style.letterSpacing;
    span.style.whiteSpace = "pre";
    span.style.position = "absolute";
    span.style.visibility = "hidden";
    document.body.appendChild(span);

    let index = 0;
    let low = 0;
    let high = text.length;

    // Binary search for the closest character gap
    while (low <= high) {
        let mid = Math.floor((low + high) / 2);
        span.textContent = text.substring(0, mid);
        let width = span.getBoundingClientRect().width;

        if (width < tapX) {
            index = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    // Clean up
    document.body.removeChild(span);
    return index;
}

export function preventDoubleTapZoom() {
    let lastTouchEnd = 0;
    document.addEventListener(
        "touchend",
        (event) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                // Check if the tap was on a button or an element inside a button
                const isButton = event.target.closest(
                    "button, .btn, .svg-btn, .letter-btn",
                );

                if (!isButton) {
                    // It's a double tap on the background/empty field; block the zoom
                    event.preventDefault();
                }
            }
            lastTouchEnd = now;
        },
        { passive: false },
    );
}

export async function serverOnline() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
        const response = await fetch("/ping?t=" + Date.now(), {
            method: "HEAD",
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response.ok;
    } catch {
        return false;
    }
}
