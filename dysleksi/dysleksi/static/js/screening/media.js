export class TestMediaRecorder extends EventTarget {
    mediaRecorder;
    recording;
    recordingUpdateInterval;

    constructor(recordingUpdateInterval) {
        super();
        this.recording = [];
        this.recordingUpdateInterval = recordingUpdateInterval;
    }

    setup() {
        return new Promise((resolve, reject) => {
            if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
                const errMsg = "getUserMedia not supported";
                console.error(errMsg);
                reject(errMsg);
            } else {
                // TODO: denne metode bør kaldes fra et user-initieret event, f.eks. button click
                navigator.mediaDevices
                    .getUserMedia({ audio: true })
                    .then((stream) => {
                        this.stream = stream;
                        this.mediaRecorder = new MediaRecorder(stream);
                        this.mediaRecorder.addEventListener("dataavailable", (evt) => {
                            this.recording.push(evt.data);
                            this.dispatchEvent(new Event("recording.updated", {}));
                        });
                        resolve(); // mediaRecorder is ready
                    })
                    .catch((err) => {
                        console.error("getUserMedia error:", err);
                        reject(err);
                    });
            }
        });
    }

    start() {
        if (this.mediaRecorder.state === "inactive") {
            this.mediaRecorder.start(this.recordingUpdateInterval);
        }
    }

    interval() {
        // Extract audio stored in this.recording as one base64 string
        return new Promise((resolve) => {
            const listener = () => {
                this.removeEventListener("recording.updated", listener);
                const recordingBlob = new Blob(this.recording, {
                    type: this.recording[0].type,
                });
                const reader = new FileReader();
                reader.addEventListener("loadend", () => {
                    this.recording = [];
                    resolve(reader.result);
                });
                reader.readAsDataURL(recordingBlob);
            };
            if (this.mediaRecorder.state === "recording") {
                this.addEventListener("recording.updated", listener);
                this.stop(); // Apparently calling requestData results in invalid data that cannot be played back, so stop and restart instead
            }
            this.start();
        });
    }

    stop() {
        this.mediaRecorder.stop();
    }
}

export class AudioDetector extends EventTarget {
    constructor(
        stream,
        detectionLevelThreshold = 0.25,
        debounceTime = 2500.0, // 2.5 secs
    ) {
        super();

        this.detectionLevelThreshold = detectionLevelThreshold;
        this.debounceTime = debounceTime;

        this.state = null;
        this.lastEventAt = null;

        // Connect analyser node to media stream source
        const context = new window.AudioContext();
        const input = context.createMediaStreamSource(stream);
        this.analyser = context.createAnalyser();
        this.analyser.fftSize = 32; // fewest possible bins
        input.connect(this.analyser);
    }

    run() {
        // Take the average level of all frequency bins (scaled to 0.0-1.0)
        let avg = 0;
        for (const bin of this.getBins()) {
            avg += (bin - 128) / 256.0;
        }
        avg = Math.abs(avg);

        // Check if the average power across all bins exceeds threshold
        if (avg > this.detectionLevelThreshold) {
            this.dispatchDebounced("audio.detected");
        } else {
            this.dispatchDebounced("audio.quiet");
        }

        // Process next frame
        requestAnimationFrame(this.run.bind(this));
    }

    dispatchDebounced(event) {
        const dispatchIfChanged = (event) => {
            if (event !== this.state) {
                this.state = event;
                this.lastEventAt = document.timeline.currentTime;
                this.dispatchEvent(new Event(event));
            }
        };

        if (this.lastEventAt === null) {
            // `AudioDetector` has just initialized - dispatch immediately
            dispatchIfChanged(event);
        } else {
            // We have dispatched previous event(s) - find out how long it's been since that
            const timeSince = document.timeline.currentTime - this.lastEventAt;
            if (timeSince > this.debounceTime) {
                dispatchIfChanged(event);
            }
        }
    }

    getBins() {
        // Get frequency bins from analyser
        const bins = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteTimeDomainData(bins);
        return bins;
    }
}
