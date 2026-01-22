import { getWebSocket } from "../../ws.js";
import { Test } from "../utils.js"

export function initStudent(roomName, testContents) {
    const chatSocket = getWebSocket(roomName);
    const onCompleted = () => {
        // What to do when the test is completed?
        chatSocket.close();
        document.location = "/";
    }
    const test = new Test(testContents, chatSocket, roomName, onCompleted);
    test.start()
}
