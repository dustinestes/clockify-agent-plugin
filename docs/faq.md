<br><br>
<img align="right" src="../assets/logo.svg" height="40" alt="Clockify Agent Plugin">
<h1>Frequently Asked Questions (FAQ)</h1>
<br clear="both">

A collection of answers to popular questions about this plugin.

<br>

## Contents

- [Contents](#contents)
- [/clockify-init](#clockify-init)
- [/clockify-automate](#clockify-automate)

---

<br>

## /clockify-init

<details>
  <summary>Does init always create a Clockify project?</summary>

  <br>
  No. `/clockify-init` only pins `scope.workspace_id` and writes the v3 base yaml (prompt timer/manual, `entry.automated` off). It does **not** create Clockify projects or tasks. Run `/clockify-automate` when you want ensure + forge/Cursor automation.
</details>

<details>
  <summary>What does init write by default?</summary>

  <br>
  A copy of [`.clockify/config.yml.example`](../.clockify/config.yml.example) with your workspace id: `plugin.version: 3`, `scope.project.from: local_folder`, prompt descriptions/tasks for timer and manual, `entry.automated.enabled: false`, `forge: none`, empty triggers, Cursor platforms off. Plus ignore markers under `.clockify/` and a managed stanza in the repo `.gitignore`.
</details>

---

<br>

## /clockify-automate

<details>
  <summary>What happens if my repo has no git remotes or labels?</summary>

  <br>
  When `on_start` templates use `{label}`, automate syncs GitHub labels → Clockify tasks. If there are no remotes or labels, that sync is skipped; the project may still be ensured (and Cursor fixed tasks still ensured when Plan/Debug are on).

  Output

  ```
  GitHub label → Clockify task sync was skipped: this repo has no git remotes. No tasks were created or updated.
  ```
</details>

<details>
  <summary>Is GitLab or Bitbucket supported?</summary>

  <br>
  `entry.automated.forge` accepts `gitlab` and `bitbucket` as stubs. Only **GitHub** is implemented; the forge wizard offers GitHub as the working choice.
</details>

---

<br>

---

<strong>Clockify Agent Plugin</strong>
<div align="right">

[MIT License](../LICENSE)

</div>
<br clear="both">
