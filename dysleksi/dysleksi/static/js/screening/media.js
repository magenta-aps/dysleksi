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
                const errMsg = 'getUserMedia not supported';
                console.error(errMsg);
                reject(errMsg);
            } else {
                // TODO: denne metode bør kaldes fra et user-initieret event, f.eks. button click
                navigator.mediaDevices.getUserMedia({audio: true})
                    .then((stream) => {
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
            const listener = (evt) => {
                this.removeEventListener("recording.updated", listener);
                const recordingBlob = new Blob(this.recording, {type: this.recording[0].type});
                const reader = new FileReader();
                reader.addEventListener("loadend", () => {
                    this.recording = [];
                    resolve(reader.result);
                });
                reader.readAsDataURL(recordingBlob);
            }
            if (this.mediaRecorder.state === "recording") {
                this.addEventListener("recording.updated", listener);
                this.stop();  // Apparently calling requestData results in invalid data that cannot be played back, so stop and restart instead
            }
            this.start();
        });
    }

    stop() {
        this.mediaRecorder.stop();
    }
}
