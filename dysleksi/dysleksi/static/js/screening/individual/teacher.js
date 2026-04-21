import {
    AudioIndicator,
    EventTable,
    ActionButtons,
    ElapsedTimeView,
    TeacherView,
    QuestionView,
} from "../controlroom.js";
import { getWebSocket } from "../../ws.js";

export function initTeacher(roomName, assignmentId, test) {
    console.log("called initTeacher");

    const table = new EventTable(test);
    const buttons = new ActionButtons();
    const questionView = new QuestionView(
        "#question-container",
        "#question-title",
        "#question-content",
        "#current-test-part-name",
        "#current-test-part-number",
        "#current-test-question-number",
    );
    const elapsedTimeView = new ElapsedTimeView("#total-elapsed-time");
    const audioIndicator = new AudioIndicator("#audio-indicator");

    buttons.showButtons();
    questionView.show();

    new TeacherView(
        roomName,
        test,
        assignmentId,
        getWebSocket,
        table,
        buttons,
        null,
        questionView,
        elapsedTimeView,
        audioIndicator,
    );

    console.log("TeacherView created");
}
