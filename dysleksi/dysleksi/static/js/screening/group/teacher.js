import {
    EventTable,
    ActionButtons,
    TeacherView,
    NoteField,
    QuestionView,
    ElapsedTimeView,
} from "../controlroom.js";

export function initTeacher(assignmentId, test, students) {
    const table = new EventTable();
    const buttons = new ActionButtons();
    const noteField = new NoteField();
    const questionView = new QuestionView();
    const elapsedTimeView = new ElapsedTimeView("#total-elapsed-time");

    new TeacherView(
        test,
        assignmentId,
        table,
        buttons,
        noteField,
        questionView,
        elapsedTimeView,
        null,
        students,
    );
}
