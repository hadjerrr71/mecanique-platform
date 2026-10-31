
(function () {
  "use strict";

  const API = "/api";

  const ALLOWED_EXTENSIONS = [
    "pdf", "doc", "docx", "ppt", "pptx",
    "jpg", "jpeg", "png", "webp"
  ];

  const ALLOWED_CATEGORIES = [
    "دروس",
    "TD",
    "دراسات تقنية",
    "وثائق الأستاذ"
  ];

  const MAX_FILE_SIZE = 50 * 1024 * 1024;

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      ...options
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.error || `خطأ في الخادم: HTTP ${response.status}`
      );
    }

    return result;
  }

  function normalizeResource(resource) {
    if (!resource) return null;

    return {
      ...resource,
      id: String(resource.id),
      title: resource.title || "",
      description: resource.description || "",
      year: resource.year || "",
      semester: resource.semester || "",
      category: resource.category || "",
      fileName: resource.fileName || "document",
      fileSize: Number(resource.fileSize || 0),
      addedAt: resource.addedAt || ""
    };
  }

  async function getAll() {
    const result = await request(`${API}/resources`);

    const resources = Array.isArray(result)
      ? result
      : result.resources;

    if (!Array.isArray(resources)) {
      throw new Error("لم يتمكن الخادم من إرجاع قائمة الموارد.");
    }

    return resources.map(normalizeResource);
  }

  async function get(id) {
    if (!id) return null;

    try {
      const result = await request(
        `${API}/resources/${encodeURIComponent(id)}`
      );

      return normalizeResource(result.resource || result);
    } catch (error) {
      if (error.message.includes("404")) {
        return null;
      }

      throw error;
    }
  }

  async function save(data, file, id) {
    const formData = new FormData();

    formData.append("title", String(data.title || "").trim());
    formData.append("description", String(data.description || "").trim());
    formData.append("year", data.year || "");
    formData.append("semester", data.semester || "");
    formData.append("category", data.category || "");

    if (data.category && !ALLOWED_CATEGORIES.includes(data.category)) {
      throw new Error("نوع الوثيقة غير صالح.");
    }

    if (id) {
      formData.append("id", id);
    }

    if (file) {
      validateFile(file);
      formData.append("file", file);
    }

    const result = await request(`${API}/admin/upload`, {
      method: "POST",
      body: formData
    });

    const resource = result.resource;

    if (!resource) {
      throw new Error("لم يرجع الخادم الوثيقة المسجلة.");
    }

    return normalizeResource(resource);
  }

  async function remove(id) {
    if (!id) {
      throw new Error("معرّف الوثيقة غير موجود.");
    }

    return request(
      `${API}/admin/resources/${encodeURIComponent(id)}`,
      {
        method: "DELETE"
      }
    );
  }

  function getFileURL(resource, download = false) {
    if (!resource || !resource.id) {
      throw new Error("الوثيقة غير صالحة.");
    }

    const url =
      `${API}/resources/${encodeURIComponent(resource.id)}/file`;

    return download ? `${url}?download=1` : url;
  }

  function extensionOf(fileName) {
    const name = String(fileName || "");
    const index = name.lastIndexOf(".");

    return index >= 0
      ? name.substring(index + 1).toLowerCase()
      : "";
  }

  function validateFile(file) {
    if (!file) {
      throw new Error("يرجى اختيار ملف.");
    }

    const extension = extensionOf(file.name);

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      throw new Error(
        "صيغة الملف غير مسموح بها. استعمل PDF أو DOC أو DOCX أو PPT أو PPTX أو JPG أو PNG أو WEBP."
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error("يجب ألا يتجاوز حجم الملف 50 ميغابايت.");
    }

    return true;
  }

  function formatSize(bytes) {
    const size = Number(bytes || 0);

    if (size < 1024) {
      return `${size} بايت`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} كيلوبايت`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} ميغابايت`;
  }

  function formatDate(value) {
    if (!value) return "تاريخ غير معروف";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return new Intl.DateTimeFormat("ar-DZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(date);
  }

  function semesterLabel(semester) {
    const labels = {
      S1: "السداسي الأول",
      S2: "السداسي الثاني",
      S3: "السداسي الثالث"
    };

    return labels[semester] || semester || "";
  }

  function isPreviewable(resource) {
    const extension = extensionOf(resource?.fileName);

    return [
      "pdf", "jpg", "jpeg", "png", "webp"
    ].includes(extension);
  }

  window.MecaniqueStorage = {
    getAll,
    get,
    save,
    remove,
    getFileURL,
    extensionOf,
    validateFile,
    formatSize,
    formatDate,
    semesterLabel,
    isPreviewable,
    ALLOWED_CATEGORIES
  };
})();
