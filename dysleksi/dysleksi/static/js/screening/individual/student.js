import { getAssignmentSocket } from "../../ws.js";
import { GroupTestDomElements, IndividualTestDomElements } from "../dom.js";
import { TestMediaRecorder } from "../media.js";
import { IndividualTestView } from "./student-individual-test.js";
import { DyslexiaTestView } from "../dyslexia/student-dyslexia-test.js";

export function initStudent(assignmentId, test, student, testType) {
    const assignmentSocket = getAssignmentSocket(assignmentId);
    const [TestView, TestDomElements] =
        testType === "dyslexia"
            ? [DyslexiaTestView, GroupTestDomElements]
            : [IndividualTestView, IndividualTestDomElements];
    const domElements = new TestDomElements();

    // Start when socket is ready
    assignmentSocket.addEventListener("open", async () => {
        console.log("Socket open");
        const testMediaRecorder = new TestMediaRecorder(5000);
        const sendToTeacher = (data) => {
            assignmentSocket.send(
                JSON.stringify({
                    uuid: crypto.randomUUID(),
                    studentDisplayName: student.displayName,
                    ...data,
                }),
            );
        };
        let view = null;
        testMediaRecorder.addEventListener("mic.lost", () => {
            console.error("Lost access to the microphone");
            if (view === null || view.needsMicrophone()) {
                sendToTeacher({
                    event: "setup.error",
                    error: "microphone access lost",
                });
            }
        });
        testMediaRecorder.addEventListener("mic.restored", () => {
            sendToTeacher({ event: "setup.restored" });
        });
        await testMediaRecorder.setup().catch((err) => {
            console.error("Cannot start audio recording:", err);
            sendToTeacher({ event: "setup.error", error: err.toString() });
        });

        // The test cannot start without a microphone, so let the student grant
        // permission and try again. Retrying from the button click also means
        // the browser allows us to prompt for permission.
        while (!testMediaRecorder.mediaRecorder) {
            domElements.showMicLostOverlay();
            await new Promise((resolve) =>
                domElements.setRestoreMicButtonListener(resolve),
            );
            await testMediaRecorder.restore();
        }
        domElements.hideMicLostOverlay();

        console.log("Audio recording setup complete");
        view = new TestView(
            test,
            assignmentId,
            domElements,
            testMediaRecorder,
            student,
        );

        view.start();
    });
}
