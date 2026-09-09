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
- [/clockify-automate-disable](#clockify-automate-disable)

---

<br>

## /clockify-init

<details>
  <summary>Does init always create a Clockify project?</summary>

  <br>
  No. `/clockify-init` only pins `scope.workspace_id` and writes the v4 base yaml (prompt descriptions, timer task none, `entry.automated` off). It does **not** create Clockify projects or tasks. Run `/clockify-automate` when you want ensure + forge/Cursor automation.
</details>

<details>
  <summary>What does init write by default?</summary>

  <br>
  A copy of [`.clockify/config.yml.example`](../.clockify/config.yml.example) with your workspace id: `plugin.version: 4`, `scope.project.from: local_folder`, timer description prompt / task none, manual prompt defaults, `entry.automated.enabled: false`, all forges off, empty triggers, Cursor platforms off. Plus ignore markers under `.clockify/` and a managed stanza in the repo `.gitignore`. v1/v2/v3 configs fail closed — re-run `/clockify-init`.
</details>

---

<br>

## /clockify-automate

<details>
  <summary>What happens if my repo has no git remotes or labels?</summary>

  <br>
  When `settings.on_start` templates use `{label}`, automate syncs GitHub labels → Clockify tasks. If there are no remotes or labels, that sync is skipped; the project may still be ensured (and Cursor fixed tasks still ensured when Plan/Debug are on).

  Output

  ```
  GitHub label → Clockify task sync was skipped: this repo has no git remotes. No tasks were created or updated.
  ```
</details>

<details>
  <summary>Is GitLab or Bitbucket supported?</summary>

  <br>
  `entry.automated.forge` is a map of `github` / `gitlab` / `bitbucket`, each with `enabled: boolean` (at most one true). Only **GitHub** is implemented; gitlab and bitbucket are stubs. The forge wizard offers GitHub as the working choice.
</details>

---

<br>

## /clockify-automate-disable

<details>
  <summary>When should I disable vs unautomate?</summary>

  <br>
  **Disable** (`/clockify-automate-disable`) is a temporary pause: Cursor rule/hooks go away, `enabled` flips off, but one forge stays enabled and `settings.on_start` / triggers / `settings.runaway` prefs / Cursor `modes` stay so `/clockify-automate-enable` can restore glue without re-running wizards.

  **Unautomate** (`/clockify-unautomate`) is a full rollback: same glue removal, plus `entry.automated` reset to example defaults (all forges off, empty triggers, modes cleared). The next `/clockify-automate` runs the wizards again.

  To remove `.clockify/` entirely, use `/clockify-uninit`.
</details>

---

<br>

---

<strong>Clockify Agent Plugin</strong>
<div align="right">

[MIT License](../LICENSE)

</div>
<br clear="both">
