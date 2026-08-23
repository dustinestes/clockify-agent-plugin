<br><br>
<img align="right" src="../assets/logo.svg" height="40" alt="Clockify Agent Plugin">
<h1>Frequently Asked Questions (FAQ)</h1>
<br clear="both">

A collection of answers to popular questions about this plugin.

<br>

## Contents

- [Contents](#contents)
- [/clockify-init](#clockify-init)

---

<br>

## /clockify-init

<details>
  <summary>What happens if my repo has no git remotes or labels?</summary>

  <br>
  For shape **1** (repo as project), the agent skips creating/updating tasks on Clockify when there are no remotes or labels. The project may still be ensured.
  
  Output

  ```
  GitHub label → Clockify task sync was skipped: this repo has no git remotes. No tasks were created or updated.
  ```
</details>

<details>
  <summary>Does init always create a Clockify project?</summary>

  <br>
  No. First-time `/clockify-init` AskQuestions for workspace, then shape. Choose **0** to write local config only. Shapes **1** and **2** create or find the project (and tasks) after that choice.
</details>



---

<br>

---

<strong>Clockify Agent Plugin</strong>
<div align="right">

[MIT License](../LICENSE)

</div>
<br clear="both">
