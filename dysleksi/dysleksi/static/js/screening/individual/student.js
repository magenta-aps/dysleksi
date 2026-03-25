import { getWebSocket } from "../../ws.js";
import { IndividualTestDomElements } from "../dom.js";
import { TestMediaRecorder } from "../media.js";
import { IndividualTestView } from "./student-individual-test.js";

export function initStudent(roomName, assignmentId, test, student) {
    const chatSocket = getWebSocket(roomName);
    const domElements = new IndividualTestDomElements();

    // Start when socket is ready
    chatSocket.addEventListener("open", async () => {
        console.log("Socket open");
        const testMediaRecorder = new TestMediaRecorder(5000);
        await testMediaRecorder
            .setup()
            .catch((err) => {
                console.error("Cannot start audio recording:", err);
                chatSocket.send(
                    JSON.stringify({
                        uuid: crypto.randomUUID(),
                        event: "setup.error",
                        id: roomName,
                        error: err.toString(),
                    }),
                );
            })
            .then(() => {
                console.log("Audio recording setup complete");
                const view = new IndividualTestView(
                    test,
                    chatSocket,
                    roomName,
                    assignmentId,
                    domElements,
                    testMediaRecorder,
                    student,
                );

                view.addEventListener("test.complete", () => {
                    chatSocket.close();
                });
                view.start();
            });
    });
}
