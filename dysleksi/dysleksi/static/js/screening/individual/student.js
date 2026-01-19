import { getWebSocket } from "../../ws.js";

export function initStudent(roomName, tests) {

    const chatSocket = getWebSocket(roomName);
    const questionEl = document.querySelector('#question');
    const choicesEl = document.querySelector('#choices');

    if (!questionEl || !choicesEl) {
        console.error("Required DOM elements missing");
        return;
    }

    let testIndex = 0;
    let mediaRecorder;
    let recording = [];
    let recordingUpdateInterval = 5000;  // Update local audio recording buffer every 5 seconds

    const setupAudioRecording = function (evt) {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then((stream) => {
                    // On success: initialize `mediaRecorder`
                    mediaRecorder = new MediaRecorder(stream);

                    mediaRecorder.ondataavailable = function (evt) {
                        recording.push(evt.data);
                        console.log('recording: add', evt.data);
                    };

                    mediaRecorder.onstop = function (evt) {
                        // Safari only supports `audio/mp4` when recording
                        // https://stackoverflow.com/a/66914924
                        // Firefox also supports `audio/ogg; codecs=opus`.
                        // Chrome also supports `audio/webm; codecs=opus`.
                        const recordingBlob = new Blob(recording, { type: 'audio/mp4' });

                        // Share audio recording with teacher (as a "data URL", which happens
                        // to be a base64 encoded string, prefixed by "data:/;base64,".)
                        const reader = new FileReader();
                        reader.onloadend = function () {
                            chatSocket.send(
                                JSON.stringify(
                                    {
                                        'event': 'test.answered',
                                        'id': '{{ room_name }}',
                                        'index': testIndex,
                                        'answeredAt': document.timeline.currentTime,
                                        'recordingBase64': reader.result,
                                    }
                                )
                            )
                        }
                        reader.readAsDataURL(recordingBlob);

                        console.log('recording: stopped', recordingBlob);
                    };
                })
                .catch((err) => {
                    // On error: inform teacher that this student device has problems
                    chatSocket.send(
                        JSON.stringify(
                            {
                                'event': 'setup.error',
                                'id': '{{ room_name }}',
                                'index': testIndex,
                                'error': err,
                            }
                        )
                    )
                    console.error(`The following getUserMedia error occurred: ${err}`);
                });
        } else {
            chatSocket.send(
                JSON.stringify(
                    {
                        'event': 'setup.error',
                        'id': '{{ room_name }}',
                        'index': testIndex,
                        'error': 'getUserMedia not supported',
                    }
                )
            )
            console.error('getUserMedia not supported');
        }
    }

    const updateTest = function () {
        const test = tests[testIndex];
        const displayedAt = document.timeline.currentTime;

        // Update headline
        questionEl.innerHTML = "" + (testIndex + 1) + "/" + tests.length  + ": " + test.question;

        // Update choices (if multiple-choice question)
        if (test.type === 'multiple-choice') {
            choicesEl.innerHTML = '';
            for (const choice of test.choices) {
                const choiceEl = document.createElement('button');
                choiceEl.innerHTML = choice;
                choiceEl.classList.add('btn');
                choiceEl.classList.add('btn-outline-primary');
                choicesEl.append(choiceEl);
                choiceEl.addEventListener('click', function (e) {
                    updateChoice(e, testIndex, displayedAt);
                });
            }
        }

        // Update question (if audio recording question)
        if (test.type === 'audio-recording') {
            // Display the letter or word which the student needs to read aloud
            choicesEl.innerHTML = test.question;

            // Begin audio recording
            recording = [];
            mediaRecorder.start(recordingUpdateInterval);
        }

        // Inform teacher that a new question is being displayed
        chatSocket.send(
            JSON.stringify(
                {
                    'event': 'test.displayed',
                    'id': '{{ room_name }}',
                    'index': testIndex,
                    'displayedAt': displayedAt,
                }
            )
        )
    }

    const updateChoice = function (e, testIndex, displayedAt) {
        // Update which choice is the active one
        const choiceEl = e.target;
        const choicesEls = document.querySelectorAll('div#choices button');
        choicesEls.forEach(function (el) {
            el.classList.remove('btn-primary');
            el.classList.add('disabled');
        });
        choiceEl.classList.replace('btn-outline-primary', 'btn-primary');

        // Inform teacher of answer event
        chatSocket.send(
            JSON.stringify(
                {
                    'event': 'test.answered',
                    'id': '{{ room_name }}',
                    'choice': choiceEl.innerHTML,
                    'index': testIndex,
                    'displayedAt': displayedAt,
                    'answeredAt': document.timeline.currentTime,
                }
            )
        )
    };

    chatSocket.onmessage = function (e) {
        console.log('chat: received', e.data);
        const data = JSON.parse(e.data);

        if (data.event.match(/test.(correct|wrong|skipped)/)) {
            // Stop any audio recording happening on previous question
            mediaRecorder.stop();

            // Go to next question, if possible
            if ((data.index >= 0) && (data.index < tests.length - 1)) {
                testIndex++;
                updateTest();
            } else {
                alert("Testen er færdig!");
            }
        }
    };
    
    chatSocket.addEventListener("open", updateTest);
    setupAudioRecording(null);

}
