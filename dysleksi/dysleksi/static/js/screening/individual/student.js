import { getWebSocket } from "../../ws.js";
import { extractQuestions } from "../utils.js";

export function initStudent(roomName, testContents) {

    const chatSocket = getWebSocket(roomName);
    const questionEl = document.querySelector('#question');
    const choicesEl = document.querySelector('#choices');

    if (!questionEl || !choicesEl) {
        console.error("Required DOM elements missing");
        return;
    }

    // Flatten all questions
    const tests = extractQuestions(testContents);

    let testIndex = 0;
    let mediaRecorder = null;
    let recording = [];
    const recordingUpdateInterval = 5000; // Update local audio recording buffer every 5 seconds

    /**
     * Initialize microphone + MediaRecorder
     * Returns a Promise that resolves when mediaRecorder is ready
     */
    const setupAudioRecording = function () {
        return new Promise((resolve, reject) => {

            if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
                const errMsg = 'getUserMedia not supported';
                chatSocket.send(JSON.stringify({
                    event: 'setup.error',
                    id: roomName,
                    index: testIndex,
                    error: errMsg,
                }));
                console.error(errMsg);
                reject(errMsg);
                return;
            }

            navigator.mediaDevices.getUserMedia({ audio: true })
                .then((stream) => {
                    mediaRecorder = new MediaRecorder(stream);

                    mediaRecorder.ondataavailable = function (evt) {
                        recording.push(evt.data);
                    };

                    resolve(); // mediaRecorder is ready
                })
                .catch((err) => {
                    chatSocket.send(JSON.stringify({
                        event: 'setup.error',
                        id: roomName,
                        index: testIndex,
                        error: err.toString(),
                    }));
                    console.error("getUserMedia error:", err);
                    reject(err);
                });
        });
    };

    /**
     * Stop recording and send test.answered
     * Resolves only when audio has been fully sent
     */
    const stopRecordingAndSendAnswer = function () {
        return new Promise((resolve) => {
            if (!mediaRecorder || mediaRecorder.state !== "recording") {
                resolve();
                return;
            }

            mediaRecorder.onstop = function () {
                const recordingBlob = new Blob(recording, { type: 'audio/mp4' });
                const reader = new FileReader();

                reader.onloadend = function () {
                    chatSocket.send(JSON.stringify({
                        event: 'test.answered',
                        id: roomName,
                        index: testIndex,
                        answeredAt: document.timeline.currentTime,
                        recordingBase64: reader.result,
                    }));

                    resolve(); // ✅ audio sent
                };

                reader.readAsDataURL(recordingBlob);
            };

            mediaRecorder.stop();
        });
    };

    /**
     * Display current test and start recording
     */
    const updateTest = function () {
        const test = tests[testIndex];
        const displayedAt = document.timeline.currentTime;

        // Update headline
        questionEl.innerHTML =
            `${testIndex + 1}/${tests.length}: ${test.partName}`;

        // Display the letter / word to read aloud
        choicesEl.innerHTML = test.challengeText;

        // Start audio recording
        recording = [];
        mediaRecorder.start(recordingUpdateInterval);

        chatSocket.send(JSON.stringify({
            event: 'test.displayed',
            id: roomName,
            index: testIndex,
            displayedAt: displayedAt,
        }));
    };

    /**
     * Handle messages from teacher
     */
    chatSocket.onmessage = async function (e) {
        console.log('chat: received', e.data);
        const data = JSON.parse(e.data);
    
        if (data.event === 'teacher.ready') {
            console.log("Teacher ready, starting test");
            updateTest();  // now safe to send test.displayed
            return;
        }
    
        if (data.event.match(/test\.(correct|wrong|skipped)/)) {
            // Ensure test.answered is sent BEFORE moving on
            await stopRecordingAndSendAnswer();

            if (testIndex < tests.length - 1) {
                testIndex++;
                updateTest();
            } else {
                alert("Testen er færdig!");
            }
        }
    };

    // Start when socket is ready
    chatSocket.addEventListener("open", async () => {
        try {
            await setupAudioRecording();  // initialize microphone
    
            // Don't start test yet — wait for teacher
            console.log("Student socket open, waiting for teacher ready");
        } catch (err) {
            console.error("Cannot start test because audio setup failed:", err);
        }
    });
}
