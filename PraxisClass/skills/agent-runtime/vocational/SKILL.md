---
name: vocational
title: "职业实训"
description: Design vocational learning from the current teaching goal, learner background and supplied materials. Choose explanation, code, simulation, procedural practice, quiz or project work as appropriate.
---

# Vocational teaching design

Use the current teacher request and selected sources to decide how this course should teach.
Preserve explicit audience, duration, quantities, technologies and deliverables. Teaching methods are suggestions; they must not override the request.

## Choose an appropriate learning sequence

Teach necessary concepts and worked examples when learners need them, then use suitable practice and feedback. Reflection or a summary may help consolidate the task.
Choose page count and scene mix for the actual goal. There is no fixed minimum number of procedural pages, maximum number of explanation slides, or mandatory quiz/PBL ending.
Curriculum recommendations and competency graphs are optional teacher-planning methods. Do not automatically add them to every student course.
Use natural teaching language. Internal tool names, generation checks and competition bookkeeping do not belong in lesson narration.

## Select teaching mechanisms

- slide: concepts, examples, explanations, introductions or reflection.
- code: actual code work with an explicit task contract and execution environment.
- simulation: a declared model with learner-controlled inputs and rules that calculate outputs.
- diagram: relationships or processes the learner needs to understand.
- procedural-skill: a real operation flow with tools/state, meaningful decisions and consequences.
- game: concrete playable objects, controls, outcome conditions and useful feedback.
- quiz: assess the stated goal, with the requested question count/types and grounded feedback.
- pbl: develop an open deliverable when project work fits the request.

GO/STOP judgments and safety checks are appropriate for relevant operations, not universal lesson templates. Do not force procedural-skill onto software concepts or non-procedural topics.
Vary activity framing according to the task; do not make every page a checklist.

## Preserve the existing scene contracts

Interactive widgetOutline objects retain task, steps and successCriteria, followed by the selected widget's fields. These describe the activity, not a required visual layout.
For procedural-skill also provide procedureType, tools and errorConsequences. Use real task steps and observable results.
For quizzes preserve explicit questionCount and questionTypes in quizConfig. Use pblConfig for projects. Do not attach interactive fields to slides, quizzes or PBL.

## Truthful content and usable interactions

Use selected source facts and reliable file/page/section references. Do not invent source links, standards, learner performance or execution receipts.
State the actual execution mechanism where it matters to the learner. Do not describe keyword matching, static checks or simulations as real compilation or external API execution.
Interactive scripts must be valid browser JavaScript. Check controls, meaningful feedback and any retry/reset paths the activity provides.
When inputs change, invalidate derived conclusions and recalculate. A stopped or failed operation can be a valid recorded outcome; do not fabricate successful completion.
Preserve real student input. Testing an activity is not a student submission or proof of learning.
If execution conditions are unavailable, retain the work and report that condition; do not weaken the learning goal.

## Work incrementally

Use the current course brief. Plan only when creating or substantially replanning; a local edit should read and update the affected content.
Save useful progress, inspect actual results, and repair concrete defects locally. Keep valid pages and source links.
Judge completeness against the current teaching request. Structure checks alone do not prove teaching quality.
