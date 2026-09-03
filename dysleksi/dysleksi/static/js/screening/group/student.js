import { getAssignmentSocket } from "../../ws.js";
import { GroupTestDomElements } from "../dom.js";
import { GroupTestView } from "./student-group-test.js";

export function initStudent(assignmentId, test, student) {
    const assignmentSocket = getAssignmentSocket(assignmentId);
    const domElements = new GroupTestDomElements();

    // Start when socket is ready
    assignmentSocket.addEventListener("open", async () => {
        console.log("Socket open");
        try {
            const view = new GroupTestView(test, assignmentId, domElements, student);

            view.start();
        } catch (err) {
            console.error("Cannot start test because audio setup failed:", err);
        }
    });
}
