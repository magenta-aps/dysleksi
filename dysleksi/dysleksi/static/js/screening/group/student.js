import { getWebSocket } from "../../ws.js";
import { GroupTestDomElements } from "../dom.js"
import { GroupTest } from "../test.js"

export function initStudent(roomName, testContents) {
    const chatSocket = getWebSocket(roomName);
    const domElements = new GroupTestDomElements();

    // Start when socket is ready
    chatSocket.addEventListener("open", async () => {
        console.log("Socket open");
        try {
            const test = new GroupTest(testContents, chatSocket, roomName, domElements);
            test.addEventListener("test.complete", (evt) => {
                // What to do when the test is completed?
                chatSocket.close();
                document.location = "/";
            });
            test.start()
        } catch (err) {
            console.error("Cannot start test because audio setup failed:", err);
        }
    });
}
