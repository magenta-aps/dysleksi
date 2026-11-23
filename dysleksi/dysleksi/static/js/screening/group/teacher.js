import {
    EventTable,
    ActionButtons,
    TeacherView,
    NoteField,
    QuestionView,
} from "../controlroom.js";

export function initTeacher(assignmentId, test, students) {
    const table = new EventTable();
    const buttons = new ActionButtons();
    const noteField = new NoteField();
    const questionView = new QuestionView();

    new TeacherView(
        test,
        assignmentId,
        table,
        buttons,
        noteField,
        questionView,
        null,
        students,
    );
}
