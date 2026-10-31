
(function () {
  "use strict";

  const $ = id => document.getElementById(id);

  // ==================================================
  // 1. ELEMENTS HTML
  // ==================================================

  const form = $("resource-form");
  const title = $("resource-title");
  const description = $("resource-description");
  const year = $("resource-year");
  const semester = $("resource-semester");
  const category = $("resource-category");
  const fileInput = $("resource-file");
  const idInput = $("resource-id");

  const filePrompt = $("file-prompt");
  const submit = $("submit-resource");
  const cancel = $("cancel-edit");
  const message = $("form-message");

  const list = $("admin-resource-list");
  const search = $("admin-search-input");
  const count = $("admin-count");

  const driveStatus = $("drive-status");
  const logoutButton = $("logout-button");

  const CATEGORIES = [
    "دروس",
    "TD",
    "دراسات تقنية",
    "وثائق الأستاذ"
  ];

  const YEARS = [
    "1AS",
    "2AS",
    "3AS"
  ];

  const UNCLASSIFIED_YEAR = "À classer";

  let all = [];
  let sessionValid = false;
  let editingResource = null;

  // ==================================================
  // 2. SECURITE HTML
  // ==================================================

  const esc = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  // ==================================================
  // 3. MESSAGES
  // ==================================================

  function showMessage(text, type = "error") {
    if (!message) return;

    message.textContent = text;
    message.className = `form-message ${type}`;
    message.hidden = false;
  }

  function hideMessage() {
    if (!message) return;

    message.hidden = true;
    message.textContent = "";
    message.className = "form-message";
  }

  // ==================================================
  // 4. SELECTION ANNEE
  // ==================================================

  function setSelectValue(select, value) {
    if (!select) return;

    const target = String(value ?? "");

    // Ajouter temporairement une option si elle
    // n'existe pas déjà, par exemple "À classer".
    let option = Array.from(select.options).find(
      item => item.value === target
    );

    if (!option && target) {
      option = document.createElement("option");
      option.value = target;
      option.textContent = target;
      select.appendChild(option);
    }

    select.value = target;
  }

  // ==================================================
  // 5. RESET FORMULAIRE
  // ==================================================

  function resetForm() {
    if (!form) return;

    form.reset();

    if (idInput) idInput.value = "";

    if (year) year.value = "1AS";
    if (semester) semester.value = "S1";
    if (category) category.value = "دروس";

    if (fileInput) fileInput.value = "";

    editingResource = null;

    if (filePrompt) {
      filePrompt.textContent =
        "اختر ملفاً لاستيراده";
    }

    const heading = $("form-heading");

    if (heading) {
      heading.textContent = "إضافة مورد جديد";
    }

    if (submit) {
      submit.innerHTML = 'نشر المورد <span>←</span>';
      submit.disabled = false;
    }

    if (cancel) {
      cancel.hidden = true;
    }

    hideMessage();
  }

  // ==================================================
  // 6. ICONE FICHIER
  // ==================================================

  function fileIcon(resource) {
    const ext = MecaniqueStorage.extensionOf(
      resource.fileName
    );

    const isImage = [
      "jpg",
      "jpeg",
      "png",
      "webp"
    ].includes(ext);

    return `
      <span
        class="file-icon${isImage ? " image" : ""}"
        aria-label="ملف ${esc(ext || "FILE")}"
      >
        ${esc(ext || "FILE")}
      </span>
    `;
  }

  // ==================================================
  // 7. AFFICHAGE DES RESSOURCES
  // ==================================================

  function render() {
    if (!list || !count) return;

    const query = search
      ? search.value.trim().toLocaleLowerCase("ar")
      : "";

    const items = all.filter(resource => {
      const text = [
        resource.title,
        resource.fileName,
        resource.year,
        resource.semester,
        resource.category
      ].join(" ").toLocaleLowerCase("ar");

      return !query || text.includes(query);
    });

    count.textContent = `${all.length} وثيقة`;

    if (!items.length) {
      list.innerHTML = `
        <div class="empty-admin">
          ${
            all.length
              ? "لا توجد نتائج لهذا البحث."
              : "لا توجد موارد منشورة."
          }
        </div>
      `;

      return;
    }

    list.innerHTML = items.map(resource => `
      <article class="admin-resource">

        <div class="admin-resource-head">

          ${fileIcon(resource)}

          <div class="admin-resource-info">

            <h3>${esc(resource.title)}</h3>

            <p>
              ${esc(resource.fileName)}
              ·
              ${esc(
                MecaniqueStorage.formatSize(
                  resource.fileSize
                )
              )}
            </p>

            <div class="admin-resource-tags">

              <span>${esc(resource.year || "À classer")}</span>

              <span>
                ${esc(
                  MecaniqueStorage.semesterLabel(
                    resource.semester
                  )
                )}
              </span>

              <span>${esc(resource.category)}</span>

              <span>
                تاريخ الإضافة:
                ${esc(
                  MecaniqueStorage.formatDate(
                    resource.addedAt
                  )
                )}
              </span>

            </div>

          </div>
        </div>

        <div class="admin-resource-actions">

          <button
            class="small-btn"
            type="button"
            data-edit="${esc(resource.id)}"
          >
            ✎ تعديل
          </button>

          <button
            class="small-btn"
            type="button"
            data-replace="${esc(resource.id)}"
          >
            ↑ استبدال الملف
          </button>

          ${
            MecaniqueStorage.isPreviewable(resource)
              ? `
                <button
                  class="small-btn"
                  type="button"
                  data-preview="${esc(resource.id)}"
                >
                  ↗ معاينة
                </button>
              `
              : ""
          }

          <button
            class="small-btn danger-btn"
            type="button"
            data-delete="${esc(resource.id)}"
          >
            حذف
          </button>

        </div>

      </article>
    `).join("");

    // Modifier
    list.querySelectorAll("[data-edit]").forEach(button => {
      button.addEventListener("click", () => {
        editResource(button.dataset.edit);
      });
    });

    // Remplacer
    list.querySelectorAll("[data-replace]").forEach(button => {
      button.addEventListener("click", () => {
        replaceResource(button.dataset.replace);
      });
    });

    // Prévisualiser
    list.querySelectorAll("[data-preview]").forEach(button => {
      button.addEventListener("click", () => {
        previewResource(button.dataset.preview);
      });
    });

    // Supprimer
    list.querySelectorAll("[data-delete]").forEach(button => {
      button.addEventListener("click", () => {
        deleteResource(button.dataset.delete);
      });
    });
  }

  // ==================================================
  // 8. CHARGEMENT RESSOURCES
  // ==================================================

  async function reload() {
    all = await MecaniqueStorage.getAll();
    render();
  }

  // ==================================================
  // 9. REQUETE API
  // ==================================================

  async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      ...options
    });

    const result = await response.json().catch(() => ({}));

    if (response.status === 401) {
      sessionValid = false;
      throw new Error(
        "Session expirée. Reconnecte-toi."
      );
    }

    if (!response.ok) {
      throw new Error(
        result.error || `Erreur HTTP ${response.status}`
      );
    }

    return result;
  }

  // ==================================================
  // 10. UPLOAD VERS GOOGLE DRIVE
  // ==================================================

  async function uploadResource(data, file, id) {
    const formData = new FormData();

    formData.append("title", data.title);
    formData.append(
      "description",
      data.description || ""
    );

    formData.append("year", data.year);
    formData.append("semester", data.semester);
    formData.append("category", data.category);

    if (id) {
      formData.append("id", id);
    }

    if (file) {
      formData.append("file", file);
    }

    const result = await apiRequest(
      "/api/admin/upload",
      {
        method: "POST",
        body: formData
      }
    );

    if (!result.resource) {
      throw new Error(
        "Le serveur n'a pas retourné la ressource."
      );
    }

    return result.resource;
  }

  // ==================================================
  // 11. PREPARER MODIFICATION
  // ==================================================

  async function editResource(id) {
    try {
      const resource = await MecaniqueStorage.get(id);

      if (!resource) {
        throw new Error("الوثيقة غير موجودة.");
      }

      editingResource = resource;

      idInput.value = resource.id;
      title.value = resource.title || "";
      description.value = resource.description || "";

      setSelectValue(year, resource.year || UNCLASSIFIED_YEAR);
      setSelectValue(semester, resource.semester || "S1");
      setSelectValue(category, resource.category || "دروس");

      fileInput.value = "";

      if (filePrompt) {
        filePrompt.textContent =
          `الملف الحالي: ${resource.fileName}`;
      }

      $("form-heading").textContent = "تعديل المورد";

      if (submit) {
        submit.innerHTML =
          'حفظ التعديلات <span>←</span>';
      }

      if (cancel) cancel.hidden = false;

      showMessage(
        "لتعديل معلومات المورد فقط، نحتاج إلى تفعيل مسار تحديث البيانات في الخادم. لا تختَر ملفاً جديداً قبل إضافة هذا المسار.",
        "info"
      );

      form.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

      title.focus();

    } catch (error) {
      showMessage(error.message);
    }
  }

  // ==================================================
  // 12. PREPARER REMPLACEMENT FICHIER
  // ==================================================

  async function replaceResource(id) {
    try {
      const resource = await MecaniqueStorage.get(id);

      if (!resource) {
        throw new Error("الوثيقة غير موجودة.");
      }

      editingResource = resource;

      idInput.value = resource.id;
      title.value = resource.title || "";
      description.value = resource.description || "";

      setSelectValue(year, resource.year || UNCLASSIFIED_YEAR);
      setSelectValue(semester, resource.semester || "S1");
      setSelectValue(category, resource.category || "دروس");

      fileInput.value = "";

      if (filePrompt) {
        filePrompt.textContent =
          `اختر الملف الجديد. الملف الحالي: ${resource.fileName}`;
      }

      $("form-heading").textContent = "استبدال الملف";

      if (submit) {
        submit.innerHTML =
          'حفظ الملف الجديد <span>←</span>';
      }

      if (cancel) cancel.hidden = false;

      hideMessage();

      form.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

      fileInput.focus();

    } catch (error) {
      showMessage(error.message);
    }
  }

  // ==================================================
  // 13. SUPPRESSION
  // ==================================================

  async function deleteResource(id) {
    const resource = all.find(
      item => String(item.id) === String(id)
    );

    if (!resource) return;

    const confirmed = window.confirm(
      `هل تريد حذف «${resource.title}» وملفه من Google Drive؟`
    );

    if (!confirmed) return;

    try {
      await apiRequest(
        `/api/admin/resources/${encodeURIComponent(id)}`,
        {
          method: "DELETE"
        }
      );

      await reload();

      if (String(idInput?.value) === String(id)) {
        resetForm();
      }

      showMessage(
        "تم حذف المورد بنجاح.",
        "success"
      );

    } catch (error) {
      showMessage(
        `تعذر الحذف: ${error.message}`
      );
    }
  }

  // ==================================================
  // 14. PREVISUALISATION
  // ==================================================

  async function previewResource(id) {
    try {
      const resource = await MecaniqueStorage.get(id);

      if (!resource) {
        throw new Error("الوثيقة غير موجودة.");
      }

      const url = MecaniqueStorage.getFileURL(resource);

      const tab = window.open(url, "_blank");

      if (!tab) {
        alert(
          "قام المتصفح بحظر النافذة. اسمح بالنوافذ المنبثقة."
        );
        return;
      }

      try {
        tab.opener = null;
      } catch (_) {}

    } catch (error) {
      alert(
        `تعذرت معاينة الملف: ${error.message}`
      );
    }
  }

  // ==================================================
  // 15. ENVOI FORMULAIRE
  // ==================================================

  if (form) {
    form.addEventListener("submit", async event => {
      event.preventDefault();

      hideMessage();

      if (!sessionValid) {
        showMessage(
          "الجلسة غير مؤكدة. أعد تسجيل الدخول."
        );
        return;
      }

      const file = fileInput?.files?.[0] || null;
      const resourceId = idInput?.value || null;

      if (!resourceId && !file) {
        showMessage(
          "يرجى اختيار ملف للاستيراد."
        );

        fileInput?.focus();
        return;
      }

      if (resourceId && !file) {
        showMessage(
          "تعديل المعلومات دون استبدال الملف يحتاج إلى مسار تحديث البيانات في server.js. أرسل لي هذا الجزء لأضيفه بشكل صحيح."
        );
        return;
      }

      if (!title.value.trim()) {
        showMessage("يرجى إدخال عنوان الوثيقة.");
        title.focus();
        return;
      }

      if (!YEARS.includes(year.value)) {
        showMessage("اختر سنة دراسية صحيحة.");
        year.focus();
        return;
      }

      if (!CATEGORIES.includes(category.value)) {
        showMessage("اختر نوع الوثيقة.");
        category.focus();
        return;
      }

      if (file) {
        try {
          MecaniqueStorage.validateFile(file);
        } catch (error) {
          showMessage(error.message);
          fileInput?.focus();
          return;
        }
      }

      if (submit) {
        submit.disabled = true;
        submit.textContent = "جارٍ الحفظ...";
      }

      try {
        const saved = await uploadResource(
          {
            title: title.value.trim(),
            description: description.value.trim(),
            year: year.value,
            semester: semester.value,
            category: category.value
          },
          file,
          resourceId
        );

        await reload();
        resetForm();

        showMessage(
          `تم حفظ «${saved.title}» بنجاح.`,
          "success"
        );

        await checkDrive();

      } catch (error) {
        showMessage(
          error.message || "حدث خطأ أثناء الحفظ."
        );

      } finally {
        if (submit) {
          submit.disabled = false;

          if (idInput?.value) {
            submit.innerHTML =
              'حفظ التعديلات <span>←</span>';
          } else {
            submit.innerHTML =
              'نشر المورد <span>←</span>';
          }
        }
      }
    });
  }

  // ==================================================
  // 16. SELECTION FICHIER
  // ==================================================

  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];

      if (file) {
        if (filePrompt) {
          filePrompt.textContent =
            `${file.name} · ${MecaniqueStorage.formatSize(file.size)}`;
        }
      } else if (filePrompt) {
        filePrompt.textContent = editingResource
          ? `الملف الحالي: ${editingResource.fileName}`
          : "اختر ملفاً لاستيراده";
      }

      hideMessage();
    });
  }

  // ==================================================
  // 17. ANNULER MODIFICATION
  // ==================================================

  if (cancel) {
    cancel.addEventListener("click", resetForm);
  }

  // ==================================================
  // 18. RECHERCHE
  // ==================================================

  if (search) {
    search.addEventListener("input", render);
  }

  // ==================================================
  // 19. MENU MOBILE
  // ==================================================

  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".main-nav");

  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");

      toggle.setAttribute(
        "aria-expanded",
        String(open)
      );

      toggle.setAttribute(
        "aria-label",
        open ? "إغلاق القائمة" : "فتح القائمة"
      );
    });
  }

  // ==================================================
  // 20. ANNEE FOOTER
  // ==================================================

  document.querySelectorAll(".current-year").forEach(element => {
    element.textContent = new Date().getFullYear();
  });

  // ==================================================
  // 21. VERIFICATION SESSION
  // ==================================================

  async function checkSession() {
    if (driveStatus) {
      driveStatus.textContent =
        "جارٍ التحقق من الجلسة...";
    }

    try {
      const result = await apiRequest(
        "/api/admin/status"
      );

      sessionValid = result.authenticated === true;

      if (!sessionValid && driveStatus) {
        driveStatus.textContent =
          "الجلسة غير موجودة. سجل الدخول.";
      }

      return sessionValid;

    } catch (error) {
      sessionValid = false;

      console.error(
        "Session :",
        error.message
      );

      if (driveStatus) {
        driveStatus.textContent =
          "تعذر التحقق من الجلسة.";
      }

      return false;
    }
  }

  // ==================================================
  // 22. ETAT GOOGLE DRIVE
  // ==================================================

  async function checkDrive() {
    if (!driveStatus) return;

    try {
      const result = await apiRequest(
        "/api/admin/drive-status"
      );

      if (result.connected) {
        driveStatus.textContent =
          "Google Drive متصل";

      } else {
        driveStatus.textContent =
          "Google Drive غير متصل. يرجى ربط الحساب.";
      }

    } catch (error) {
      console.error(
        "Google Drive :",
        error.message
      );

      driveStatus.textContent =
        "تعذر التحقق من Google Drive.";
    }
  }

  // ==================================================
  // 23. DECONNEXION
  // ==================================================

  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      logoutButton.disabled = true;

      try {
        await apiRequest(
          "/api/admin/logout",
          {
            method: "POST"
          }
        );

        window.location.replace(
          "/pages/login.html"
        );

      } catch (error) {
        logoutButton.disabled = false;

        alert(
          "تعذر تسجيل الخروج: " + error.message
        );
      }
    });
  }

  // ==================================================
  // 24. INITIALISATION
  // ==================================================

  async function init() {
    const authenticated = await checkSession();

    if (!authenticated) return;

    await checkDrive();

    try {
      await reload();

    } catch (error) {
      console.error(
        "Chargement ressources :",
        error.message
      );

      if (list) {
        list.innerHTML = `
          <div class="empty-admin">
            تعذر تحميل المكتبة.
          </div>
        `;
      }

      showMessage(error.message);
    }
  }

  init();

})();
