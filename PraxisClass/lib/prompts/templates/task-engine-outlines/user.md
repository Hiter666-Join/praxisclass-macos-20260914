Create a Task Engine outline from this vocational task request.

## User Task

{{requirement}}

---

{{userProfile}}

## Reference Materials

### PDF Content Summary

{{pdfContent}}

### Available Images

{{availableImages}}

### Retrieved and External Reference Context

{{researchContext}}

{{teacherContext}}

---

Apply the system prompt's suitability gate first.

Organize the course around the current learning goal and audience. Choose the number and sequence of explanations and activities to fit the request. Curriculum analysis, competency diagrams, procedural practice, quizzes and PBL are optional methods, not a mandatory sequence. Preserve existing scene contracts and concrete playable payloads. Use actual supplied references; identify missing essential facts without inventing them.

If the request is not a concrete job task, generate a standard outline with suitable existing scene types. Do not output `procedural-skill` for non-vocational topics. A software job is vocational even when code and PBL are more appropriate than manual operation widgets.

Return ONLY the JSON object with `languageDirective`, `courseTitle`, and `outlines`. Do not use markdown fences or explanatory text.
