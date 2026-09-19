/* Add a game: builds a `[game]` block, stores it on this device, and shows
 * the exact text to paste into website/data/games.js. Validation uses the
 * same rules as the loader, so a draft cannot be saved in a state the site
 * would then refuse to load.
 */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const escape = ExstArcade.escapeHtml;

  const FIELDS = {
    id: () => $("fieldId").value.trim(),
    title: () => $("fieldTitle").value.trim(),
    path: () => $("fieldPath").value.trim(),
    icon: () => $("fieldIcon").value.trim(),
    version: () => $("fieldVersion").value.trim(),
    description: () => $("fieldDescription").value.trim(),
    tags: () => $("fieldTags").value.trim(),
    badge: () => $("fieldBadge").value.trim(),
    featured: () => $("fieldFeatured").checked,
    hero: () => $("fieldHero").checked,
  };

  let data = null;
  let problems = [];
  let toastTimer;

  function toast(message) {
    $("toast").textContent = message;
    $("toast").classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 2600);
  }

  function currentFields() {
    const fields = {};
    Object.keys(FIELDS).forEach((key) => {
      const value = FIELDS[key]();
      if (value === "" || value === false) return;
      fields[key] = value;
    });
    return fields;
  }

  function toBlock(fields) {
    return ExstArcade.buildGameBlock(fields);
  }

  /** Every id already in use, so the builder can refuse a clash up front. */
  function takenIds() {
    const taken = new Map();
    (data?.games || []).forEach((game) => {
      const where = game.draft ? "in another draft" : "in the catalog";
      taken.set(game.id, where);
      taken.set(game.id.toLowerCase(), where);
    });
    return taken;
  }

  /**
   * Ids being edited in the form are not "taken" for the purpose of editing
   * an existing draft.
   */
  function validate(fields, editedId) {
    const taken = takenIds();
    // The draft being edited is not a clash with itself.
    if (editedId) {
      const mine = (data?.games || []).find(
        (game) => game.id === editedId && game.draft,
      );
      if (mine) {
        taken.delete(mine.id);
        taken.delete(mine.id.toLowerCase());
      }
    }
    return ExstArcade.validateGameFields(fields, { takenIds: taken });
  }

  function renderProblems(list) {
    problems = list;
    const host = $("addNotice");
    // Clear last round's marks first, so a fixed field never keeps a red
    // outline that no longer means anything.
    document
      .querySelectorAll("[name]")
      .forEach((el) => el.removeAttribute("aria-invalid"));
    if (!list.length) {
      host.innerHTML = "";
      return;
    }
    host.innerHTML =
      `<section class="catalog-notice" role="status" aria-live="polite">` +
      `<div class="notice-head"><span class="notice-chip">CHECK THESE</span></div>` +
      `<ul>${list
        .map(
          (item) =>
            `<li><strong>${escape(item.field)}</strong> ${escape(item.message)}</li>`,
        )
        .join("")}</ul></section>`;
    const first = list[0].field;
    document
      .querySelector(`[name="${first}"]`)
      ?.setAttribute("aria-invalid", "true");
  }

  function renderPreview(fields) {
    $("blockPreview").textContent = toBlock(fields);
  }

  let editingId = "";

  function refresh() {
    const fields = currentFields();
    const found = validate(fields, editingId);
    renderProblems(found);
    renderPreview(fields);
    $("saveDraft").disabled = found.length > 0;
    $("saveDraft").textContent = editingId
      ? "Update this device copy"
      : "Save to this device";
    return { fields, found };
  }

  function renderDrafts() {
    const drafts = (data?.games || []).filter((game) => game.draft);
    $("draftCount").textContent = String(drafts.length);
    $("draftsNote").hidden = drafts.length === 0;
    if (!drafts.length) {
      $("draftList").innerHTML =
        '<p class="empty-note">Nothing added here yet. Fill in the form above and it will appear in the arcade straight away.</p>';
      return;
    }
    $("draftList").innerHTML = drafts
      .map(
        (game) =>
          `<article class="draft-card" data-draft="${escape(game.id)}">` +
          `<div class="draft-head"><strong>${escape(game.title)}</strong>` +
          `<span class="count-pill">${escape(game.id)}</span></div>` +
          `<p class="hint">${escape(
            game.description || "No description yet.",
          )}</p>` +
          `<code>${escape(game.path)}</code>` +
          `<div class="draft-actions">` +
          `<button type="button" class="ghost-button" data-edit="${escape(
            game.id,
          )}">Edit</button>` +
          `<button type="button" class="ghost-button" data-remove="${escape(
            game.id,
          )}">Delete</button>` +
          `<a class="play-link" href="${escape(
            ExstArcade.gameUrl(game),
          )}">Play</a>` +
          `</div></article>`,
      )
      .join("");
  }

  function fillForm(block) {
    const [game] = ExstArcade.parseBlockText(block, "game");
    if (!game) return;
    $("fieldId").value = game.id || "";
    $("fieldTitle").value = game.title || "";
    $("fieldPath").value = game.path || "";
    $("fieldIcon").value = game.icon || "";
    $("fieldVersion").value = game.version || "";
    $("fieldDescription").value = game.description || "";
    $("fieldTags").value = (game.tags || []).join(", ");
    $("fieldBadge").value = game.badge || "";
    $("fieldHero").checked = game.hero === true;
    $("fieldFeatured").checked = game.featured === true;
    editingId = String(game.id || "");
    refresh();
    $("fieldId").focus();
  }

  function clearForm() {
    editingId = "";
    $("addForm").reset();
    refresh();
    $("saveStatus").textContent = "";
  }

  $("addForm").addEventListener("input", refresh);
  $("addForm").addEventListener("change", refresh);

  $("addForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const { fields, found } = refresh();
    const status = $("saveStatus");
    if (found.length) {
      status.textContent = "Fix the points above, then save.";
      return;
    }
    if (!ExstArcade.saveDraft(toBlock(fields))) {
      // Honest failure: nothing was stored, and the page says why.
      status.textContent =
        "This browser would not store the game (private window, or storage blocked), so nothing was saved. Copy the catalog block below instead.";
      return;
    }
    status.textContent = editingId
      ? `Updated ${fields.title} on this device.`
      : `Saved ${fields.title} on this device. It is in the arcade now.`;
    toast(`${fields.title} added to the arcade on this device.`);
    editingId = "";
    $("saveDraft").textContent = "Save to this device";
    return loadData().then(() => {
      renderDrafts();
      const draft = (data?.games || []).find((g) => g.id === fields.id);
      if (draft) fillForm(toBlock(draft));
      $("saveStatus").textContent = status.textContent;
    });
  });

  $("clearForm").addEventListener("click", clearForm);

  $("draftList").addEventListener("click", async (event) => {
    const remove = event.target.closest("[data-remove]");
    if (remove) {
      const id = remove.dataset.remove;
      const game = (data?.games || []).find((item) => item.id === id);
      if (!window.confirm(`Delete “${game ? game.title : id}” from this device?`))
        return;
      ExstArcade.deleteDraft(id);
      await loadData();
      renderDrafts();
      if (editingId === id) clearForm();
      else refresh();
      toast("Draft deleted.");
      return;
    }
    const edit = event.target.closest("[data-edit]");
    if (edit) {
      const block = ExstArcade.draftBlocks().find((text) => {
        const [game] = ExstArcade.parseBlockText(text, "game");
        return game && String(game.id).trim() === edit.dataset.edit;
      });
      if (block) fillForm(block);
      $("addForm").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  $("copyBlock").addEventListener("click", async () => {
    const text = $("blockPreview").textContent;
    try {
      await navigator.clipboard.writeText(text);
      toast("Catalog block copied — paste it into website/data/games.js.");
    } catch {
      // Clipboard access is often unavailable on file:// pages.
      const range = document.createRange();
      range.selectNodeContents($("blockPreview"));
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      toast("Select the block and copy it (Ctrl/Cmd+C).");
    }
  });

  document
    .querySelector('#footerBar [ref="back"]')
    .addEventListener("click", () => {
      location.href = "../index.html#about";
    });

  /* ---------- Boot ---------- */

  function renderStorageNote() {
    $("addStorageNote").textContent = ExstArcade.storageNoticeText();
  }

  async function loadData() {
    data = await ExstArcade.loadArcadeData();
    const host = $("addNotice");
    host.querySelector(".catalog-notice")?.remove();
    if (data.problems.length) {
      // Catalog problems can hide games the builder would otherwise clash with.
      host.insertAdjacentHTML(
        "beforeend",
        ExstArcade.catalogNoticeHtml(data.problems),
      );
    }
  }

  (async () => {
    try {
      await loadData();
      renderStorageNote();
      renderDrafts();
      refresh();
    } catch (error) {
      $("addNotice").innerHTML =
        `<section class="catalog-notice" role="alert">` +
        `<div class="notice-head"><span class="notice-chip">CATALOG ERROR</span></div>` +
        `<p class="notice-lead">${escape(error.message)}</p>` +
        `<p class="notice-hint">${escape(error.hint || "")}</p>` +
        `<p class="notice-hint">Fix the file and reload — games already added on this device are unaffected.</p></section>`;
    }
  })();
})();
