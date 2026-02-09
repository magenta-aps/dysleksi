import { getWebSocket } from "../../ws.js";
import { GroupTestDomElements } from "../dom.js"
import { Test } from "../model.js";
import { GroupTestView } from "./student-group-test.js";

export function initStudent(roomName, assignmentId, testContents) {
    const chatSocket = getWebSocket(roomName);
    const domElements = new GroupTestDomElements();

    // Start when socket is ready
    chatSocket.addEventListener("open", async () => {
        console.log("Socket open");
        try {
            //const test = new GroupTest(testContents, chatSocket, roomName, assignmentId, domElements);
            const test = new Test(testContents);
            const view = new GroupTestView(test, chatSocket, roomName, assignmentId, domElements);

            view.addEventListener("test.complete", (evt) => {
                // What to do when the test is completed?
                chatSocket.close();
                document.location = "/exit";
            });
            view.start()
        } catch (err) {
            console.error("Cannot start test because audio setup failed:", err);
        }
    });
}
