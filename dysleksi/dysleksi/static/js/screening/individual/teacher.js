import {
    EventTable,
    ActionButtons,
    TeacherView,
    NoteField,
    QuestionView,
} from "../controlroom.js";
import { getWebSocket } from "../../ws.js";

export function initTeacher(roomName, assignmentId, test) {
    console.log("called initTeacher");

    const table = new EventTable();
    const buttons = new ActionButtons();
    const noteField = new NoteField();
    const questionView = new QuestionView(
        "#question-container",
        "#question-title",
        "#question-content",
        "#current-test-part-name",
        "#current-test-part-number",
        "#current-test-question-number",
    );

    buttons.showButtons();
    noteField.show();
    questionView.show();

    new TeacherView(
        roomName,
        test,
        assignmentId,
        getWebSocket,
        table,
        buttons,
        noteField,
        questionView,
    );
    console.log("TeacherView created");
}
