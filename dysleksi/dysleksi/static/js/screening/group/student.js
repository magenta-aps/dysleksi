import { getWebSocket } from "../../ws.js";
import { GroupTestDomElements } from "../dom.js"
import { GroupTestView } from "./student-group-test.js";

export function initStudent(roomName, assignmentId, test, student) {
    const chatSocket = getWebSocket(roomName);
    const domElements = new GroupTestDomElements();

    // Start when socket is ready
    chatSocket.addEventListener("open", async () => {
        console.log("Socket open");
        try {
            const view = new GroupTestView(test, chatSocket, roomName, assignmentId, domElements, student);

            view.addEventListener("test.complete", (evt) => {
                chatSocket.close();
            });
            view.start()
        } catch (err) {
            console.error("Cannot start test because audio setup failed:", err);
        }
    });
}
