import {
    EventTable,
    ActionButtons,
    TeacherView,
    NoteField,
    QuestionView,
    ElapsedTimeView,
} from "../controlroom.js";
import { getWebSocket } from "../../ws.js";

export function initTeacher(assignmentId, test, students) {
    const table = new EventTable();
    const buttons = new ActionButtons();
    const noteField = new NoteField();
    const questionView = new QuestionView();
    const elapsedTimeView = new ElapsedTimeView("#total-elapsed-time");

    new TeacherView(
        test,
        assignmentId,
        getWebSocket,
        table,
        buttons,
        noteField,
        questionView,
        elapsedTimeView,
        null,
        students,
    );
}
