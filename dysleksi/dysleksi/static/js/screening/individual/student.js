import { getWebSocket } from "../../ws.js";
import { IndividualTestDomElements } from "../dom.js"
import { TestMediaRecorder } from "../media.js"
import { IndividualTest } from "../test.js"


export function initStudent(roomName, testContents) {
    const chatSocket = getWebSocket(roomName);
    const domElements = new IndividualTestDomElements();

    // Start when socket is ready
    chatSocket.addEventListener("open", async () => {
        console.log("Socket open");
        const testMediaRecorder = new TestMediaRecorder(5000);
        await testMediaRecorder.setup().catch(err => {
            console.error("Cannot start audio recording:", err);
            chatSocket.send(JSON.stringify({
                uuid: crypto.randomUUID(),
                event: 'setup.error',
                id: roomName,
                index: testIndex,
                error: err.toString(),
            }));
        }).then(() => {
            console.log("Audio recording setup complete");
            const test = new IndividualTest(testContents, chatSocket, roomName, domElements, testMediaRecorder);
            test.addEventListener("test.complete", (evt) => {
                // What to do when the test is completed?
                chatSocket.close();
                document.location = "/exit";
            });
            test.start()
        });

    });
}
