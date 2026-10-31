
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");
const { google } = require("googleapis");
const { Readable } = require("stream");

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const PAGES_DIR = path.join(ROOT, "pages");

const TOKENS_FILE = path.join(DATA_DIR, "google-tokens.json");
const RESOURCES_FILE = path.join(DATA_DIR, "resources.json");

fs.mkdirSync(DATA_DIR, { recursive: true });

// ======================================================
// 1. CONFIGURATION
// ======================================================

const ALLOWED_YEARS = ["1AS", "2AS", "3AS"];
const UNCLASSIFIED_YEAR = "À classer";

const SEMESTERS = {
  S1: "S1 - السداسي الأول",
  S2: "S2 - السداسي الثاني",
  S3: "S3 - السداسي الثالث"
};

const CATEGORIES = [
  "دروس",
  "TD",
  "دراسات تقنية",
  "وثائق الأستاذ"
];

const CATEGORY_MAP = {
  "Cours": "دروس",
  "دروس": "دروس",
  "TD": "TD",
  "TP": "دراسات تقنية",
  "دراسات تقنية": "دراسات تقنية",
  "Corrigés": "وثائق الأستاذ",
  "Corriges": "وثائق الأستاذ",
  "وثائق الأستاذ": "وثائق الأستاذ"
};

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp"
]);

const SYNC_INTERVAL_MS = Math.max(
  30000,
  Number(process.env.DRIVE_SYNC_INTERVAL_MS) || 60000
);

// ======================================================
// 2. VALIDATION ENVIRONNEMENT
// ======================================================

if (
  !process.env.SESSION_SECRET ||
  !process.env.ADMIN_EMAIL ||
  !process.env.ADMIN_PASSWORD
) {
  console.error(
    "Erreur : SESSION_SECRET, ADMIN_EMAIL et ADMIN_PASSWORD sont obligatoires dans .env"
  );
  process.exit(1);
}

const driveConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_REDIRECT_URI &&
  process.env.GOOGLE_DRIVE_FOLDER_ID
);

function getRootFolderId() {
  const id = String(
    process.env.GOOGLE_DRIVE_FOLDER_ID || ""
  ).trim();

  if (!id || id.includes("?") || id.includes("/")) {
    throw new Error(
      "GOOGLE_DRIVE_FOLDER_ID doit contenir uniquement l'identifiant du dossier MECANIQUE."
    );
  }

  return id;
}

// ======================================================
// 3. FONCTIONS JSON
// ======================================================

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

function writeJson(file, data) {
  const tempFile = `${file}.${process.pid}.tmp`;

  fs.writeFileSync(
    tempFile,
    JSON.stringify(data, null, 2),
    { mode: 0o600 }
  );

  fs.renameSync(tempFile, file);
}

function readResources() {
  const resources = readJson(RESOURCES_FILE, []);

  if (!Array.isArray(resources)) {
    throw new Error(
      "resources.json doit contenir un tableau."
    );
  }

  return resources;
}

function saveResources(resources) {
  writeJson(RESOURCES_FILE, resources);
}

function safeResource(resource) {
  const { driveFileId, ...publicResource } = resource;
  return publicResource;
}

// ======================================================
// 4. FONCTIONS FICHIERS
// ======================================================

function normalizeCategory(value) {
  return CATEGORY_MAP[String(value || "").trim()] || "";
}

function cleanFileName(name) {
  return path.basename(
    String(name || "document").replace(/\\/g, "/")
  ).replace(/[\r\n"]/g, "_");
}

function titleFromFileName(name) {
  return path.basename(name, path.extname(name));
}

function isAllowedFileName(name) {
  return ALLOWED_EXTENSIONS.has(
    path.extname(String(name || "")).toLowerCase()
  );
}

// Exemple : 2AS_TD_Exercice.pdf
function inferYearFromFileName(name) {
  const match = String(name || "").match(
    /(?:^|[^A-Z0-9])(1AS|2AS|3AS)(?=$|[^A-Z0-9])/i
  );

  return match ? match[1].toUpperCase() : "";
}

function isGoogleNotFound(error) {
  return (
    Number(error?.code) === 404 ||
    Number(error?.code) === 410 ||
    Number(error?.response?.status) === 404 ||
    Number(error?.response?.status) === 410
  );
}

// ======================================================
// 5. GOOGLE OAUTH
// ======================================================

const oauthClient = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

function getSavedTokens() {
  return readJson(TOKENS_FILE, null);
}

function getDrive() {
  if (!driveConfigured) {
    throw new Error(
      "Configuration Google Drive incomplète."
    );
  }

  const tokens = getSavedTokens();

  if (!tokens || !tokens.refresh_token) {
    throw new Error(
      "Compte Google non connecté."
    );
  }

  oauthClient.setCredentials(tokens);

  return google.drive({
    version: "v3",
    auth: oauthClient
  });
}

// ======================================================
// 6. GESTION DES DOSSIERS DRIVE
//
// MECANIQUE/
//   S1 - السداسي الأول/
//     دروس/
//     TD/
//     دراسات تقنية/
//     وثائق الأستاذ/
//
//   S2 - السداسي الثاني/
//
//   S3 - السداسي الثالث/
//
// Pas de dossiers par année.
// ======================================================

const folderCache = new Map();

function escapeDriveQuery(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

async function findFolderId(drive, parentId, folderName) {
  const response = await drive.files.list({
    q:
      `name = '${escapeDriveQuery(folderName)}'` +
      " and mimeType = 'application/vnd.google-apps.folder'" +
      ` and '${escapeDriveQuery(parentId)}' in parents` +
      " and trashed = false",

    pageSize: 100,
    fields: "files(id,name)",

    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });

  const folder = (response.data.files || []).find(
    item => item.name === folderName
  );

  return folder?.id || null;
}

async function findOrCreateFolder(
  drive,
  folderName,
  parentId
) {
  const key = `${parentId}:${folderName}`;

  if (folderCache.has(key)) {
    return folderCache.get(key);
  }

  const existingId = await findFolderId(
    drive,
    parentId,
    folderName
  );

  if (existingId) {
    folderCache.set(key, existingId);
    return existingId;
  }

  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId]
    },
    fields: "id,name",
    supportsAllDrives: true
  });

  folderCache.set(key, created.data.id);

  return created.data.id;
}

// Utilisé lors d'un upload depuis le site.
async function getDestinationFolder(
  drive,
  semester,
  category
) {
  const rootId = getRootFolderId();

  const semesterName = SEMESTERS[semester];
  const normalizedCategory = normalizeCategory(category);

  if (!semesterName) {
    throw new Error("Semestre invalide.");
  }

  if (!CATEGORIES.includes(normalizedCategory)) {
    throw new Error("Catégorie invalide.");
  }

  const semesterId = await findOrCreateFolder(
    drive,
    semesterName,
    rootId
  );

  return findOrCreateFolder(
    drive,
    normalizedCategory,
    semesterId
  );
}

// ======================================================
// 7. LISTER LES FICHIERS DRIVE
// ======================================================

async function listDriveChildren(drive, parentId) {
  const files = [];
  let pageToken;

  do {
    const response = await drive.files.list({
      q:
        `'${escapeDriveQuery(parentId)}' in parents` +
        " and trashed = false",

      pageSize: 1000,
      pageToken,

      fields:
        "nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,parents)",

      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    files.push(...(response.data.files || []));
    pageToken = response.data.nextPageToken;

  } while (pageToken);

  return files;
}

// ======================================================
// 8. SYNCHRONISATION AUTOMATIQUE
// ======================================================

let syncPromise = null;
let lastSuccessfulSync = null;
let lastSyncError = null;

async function syncDriveResources() {
  // Empêcher plusieurs synchronisations simultanées.
  if (syncPromise) {
    return syncPromise;
  }

  syncPromise = (async () => {
    const drive = getDrive();
    const rootId = getRootFolderId();

    // Vérifier l'accès au dossier racine avant toute modification.
    const root = await drive.files.get({
      fileId: rootId,
      fields: "id,name,mimeType,trashed",
      supportsAllDrives: true
    });

    if (
      root.data.trashed ||
      root.data.mimeType !== "application/vnd.google-apps.folder"
    ) {
      throw new Error(
        "Le dossier racine Google Drive est invalide."
      );
    }

    const previousResources = readResources();

    const previousByDriveId = new Map(
      previousResources
        .filter(item => item.driveFileId)
        .map(item => [item.driveFileId, item])
    );

    const discovered = [];
    const seenDriveIds = new Set();

    // Parcours des semestres.
    for (const [semester, semesterName] of Object.entries(SEMESTERS)) {

      const semesterId = await findFolderId(
        drive,
        rootId,
        semesterName
      );

      if (!semesterId) {
        continue;
      }

      // Parcours des catégories.
      for (const category of CATEGORIES) {

        const categoryId = await findFolderId(
          drive,
          semesterId,
          category
        );

        if (!categoryId) {
          continue;
        }

        const files = await listDriveChildren(
          drive,
          categoryId
        );

        for (const file of files) {

          if (
            file.mimeType ===
            "application/vnd.google-apps.folder"
          ) {
            continue;
          }

          if (!isAllowedFileName(file.name)) {
            continue;
          }

          seenDriveIds.add(file.id);

          const previous = previousByDriveId.get(file.id);
          const fileName = cleanFileName(file.name);

          const detectedYear =
            inferYearFromFileName(fileName);

          // Conserver l'année déjà enregistrée.
          // Sinon lire le préfixe du nom.
          // Ne jamais inventer une année.
          const year =
            detectedYear ||
            previous?.year ||
            UNCLASSIFIED_YEAR;

          const renamed =
            previous &&
            previous.fileName &&
            previous.fileName !== fileName;

          discovered.push({
            id: previous?.id || crypto.randomUUID(),

            title:
              renamed || !previous
                ? titleFromFileName(fileName)
                : previous.title,

            description: previous?.description || "",

            year,
            semester,
            category,

            fileName,
            fileSize: Number(file.size || 0),
            mimeType: file.mimeType,

            driveFileId: file.id,

            addedAt:
              previous?.addedAt ||
              file.createdTime ||
              new Date().toISOString(),

            updatedAt:
              file.modifiedTime ||
              new Date().toISOString()
          });
        }
      }
    }

    // Ne sauvegarder qu'après un parcours complet réussi.
    saveResources(discovered);

    const added = discovered.filter(
      item => !previousByDriveId.has(item.driveFileId)
    ).length;

    const removed = previousResources.filter(
      item =>
        item.driveFileId &&
        !seenDriveIds.has(item.driveFileId)
    ).length;

    const unclassified = discovered.filter(
      item => item.year === UNCLASSIFIED_YEAR
    ).length;

    lastSuccessfulSync = new Date().toISOString();
    lastSyncError = null;

    console.log(
      `[Drive] Synchronisation terminée : ${discovered.length} fichiers, ${added} ajoutés, ${removed} retirés, ${unclassified} à classer.`
    );

    return {
      success: true,
      total: discovered.length,
      added,
      removed,
      unclassified,
      lastSync: lastSuccessfulSync
    };
  })();

  try {
    return await syncPromise;
  } catch (error) {
    lastSyncError = error.message;

    console.error(
      "[Drive] Synchronisation échouée :",
      error.message
    );

    throw error;
  } finally {
    syncPromise = null;
  }
}

// ======================================================
// 9. DÉCLENCHEMENT AUTOMATIQUE EN ARRIÈRE-PLAN
// ======================================================

async function syncIfDue() {
  if (
    !driveConfigured ||
    !getSavedTokens()?.refresh_token
  ) {
    return;
  }

  if (syncPromise) {
    return syncPromise;
  }

  const lastTime = lastSuccessfulSync
    ? new Date(lastSuccessfulSync).getTime()
    : 0;

  if (Date.now() - lastTime >= SYNC_INTERVAL_MS) {
    await syncDriveResources();
  }
}

// ======================================================
// 10. MULTER
// ======================================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 50 * 1024 * 1024
  },

  fileFilter(req, file, callback) {
    if (!isAllowedFileName(file.originalname)) {
      return callback(
        new Error("Format de fichier non autorisé.")
      );
    }

    callback(null, true);
  }
});

// ======================================================
// 11. MIDDLEWARES
// ======================================================

app.disable("x-powered-by");

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    name: "mecanique.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,

    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000
    }
  })
);

// ======================================================
// 12. DOSSIERS STATIQUES
// ======================================================

for (const [url, folder] of [
  ["/css", path.join(ROOT, "css")],
  ["/js", path.join(ROOT, "js")],
  ["/assets", path.join(ROOT, "assets")],
  ["/public", path.join(ROOT, "public")]
]) {
  if (fs.existsSync(folder)) {
    app.use(url, express.static(folder));
  }
}

// ======================================================
// 13. AUTHENTIFICATION
// ======================================================

function requireAdmin(req, res, next) {
  if (req.session?.adminAuthenticated !== true) {
    return res.status(401).json({
      success: false,
      error: "Session expirée. Connectez-vous."
    });
  }

  next();
}

app.get("/pages/admin.html", (req, res, next) => {
  if (req.session?.adminAuthenticated !== true) {
    return res.redirect("/pages/login.html");
  }

  next();
});

// ======================================================
// 14. PAGE D'ACCUEIL
// ======================================================

app.get("/", (req, res) => {
  const indexFile = path.join(ROOT, "index.html");

  if (fs.existsSync(indexFile)) {
    return res.sendFile(indexFile);
  }

  res.status(404).send("Page d'accueil introuvable.");
});

if (fs.existsSync(PAGES_DIR)) {
  app.use("/pages", express.static(PAGES_DIR));
}

// ======================================================
// 15. LOGIN ADMIN
// ======================================================

app.post("/api/admin/login", (req, res, next) => {
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();

  const password = String(req.body?.password || "");

  const expectedEmail = String(
    process.env.ADMIN_EMAIL
  ).trim().toLowerCase();

  const expectedPassword = String(
    process.env.ADMIN_PASSWORD
  );

  const emailBuffer = Buffer.from(email);
  const expectedEmailBuffer = Buffer.from(expectedEmail);

  const emailMatches =
    emailBuffer.length === expectedEmailBuffer.length &&
    crypto.timingSafeEqual(
      emailBuffer,
      expectedEmailBuffer
    );

  const passwordBuffer = Buffer.from(password);
  const expectedPasswordBuffer = Buffer.from(
    expectedPassword
  );

  const passwordMatches =
    passwordBuffer.length === expectedPasswordBuffer.length &&
    crypto.timingSafeEqual(
      passwordBuffer,
      expectedPasswordBuffer
    );

  if (!emailMatches || !passwordMatches) {
    return res.status(401).json({
      success: false,
      error: "Email ou mot de passe incorrect."
    });
  }

  req.session.regenerate(error => {
    if (error) {
      return next(error);
    }

    req.session.adminAuthenticated = true;
    req.session.adminEmail = expectedEmail;

    req.session.save(saveError => {
      if (saveError) {
        return next(saveError);
      }

      res.set("Cache-Control", "no-store");

      res.json({
        success: true
      });
    });
  });
});

app.get("/api/admin/status", (req, res) => {
  res.set("Cache-Control", "no-store");

  res.json({
    authenticated:
      req.session?.adminAuthenticated === true
  });
});

app.get(
  "/api/admin/me",
  requireAdmin,
  (req, res) => {
    res.json({
      authenticated: true,
      email: req.session.adminEmail
    });
  }
);

app.post("/api/admin/logout", (req, res) => {
  if (!req.session) {
    return res.json({ success: true });
  }

  req.session.destroy(error => {
    if (error) {
      return res.status(500).json({
        success: false,
        error: "Déconnexion impossible."
      });
    }

    res.clearCookie("mecanique.sid", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/"
    });

    res.json({ success: true });
  });
});

// ======================================================
// 16. CONNEXION GOOGLE
// ======================================================

app.get("/auth/google", requireAdmin, (req, res) => {
  if (!driveConfigured) {
    return res.status(503).send(
      "Configuration Google Drive incomplète."
    );
  }

  const state = crypto.randomBytes(24).toString("hex");

  req.session.googleOAuthState = state;

  req.session.save(error => {
    if (error) {
      return res.status(500).send(
        "Impossible de préparer la connexion Google."
      );
    }

    const url = oauthClient.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",

      scope: [
        "https://www.googleapis.com/auth/drive"
      ],

      state
    });

    res.redirect(url);
  });
});

// ======================================================
// 17. CALLBACK GOOGLE
// ======================================================

app.get(
  "/auth/google/callback",
  requireAdmin,
  async (req, res) => {
    try {
      const expectedState = req.session.googleOAuthState;
      const receivedState = String(req.query.state || "");

      if (
        !expectedState ||
        !receivedState ||
        expectedState !== receivedState
      ) {
        return res.status(403).send(
          "État OAuth invalide. Recommence la connexion."
        );
      }

      delete req.session.googleOAuthState;

      if (req.query.error) {
        return res.status(400).send(
          "Connexion Google annulée."
        );
      }

      if (typeof req.query.code !== "string") {
        return res.status(400).send(
          "Code Google manquant."
        );
      }

      const { tokens } = await oauthClient.getToken(
        req.query.code
      );

      const previousTokens = readJson(
        TOKENS_FILE,
        {}
      );

      const savedTokens = {
        ...previousTokens,
        ...tokens,

        refresh_token:
          tokens.refresh_token ||
          previousTokens.refresh_token
      };

      if (!savedTokens.refresh_token) {
        return res.status(400).send(
          "Jeton Google manquant. Recommence la connexion."
        );
      }

      writeJson(TOKENS_FILE, savedTokens);

      oauthClient.setCredentials(savedTokens);

      folderCache.clear();
      lastSuccessfulSync = null;

      req.session.googleConnected = true;

      req.session.save(async error => {
        if (error) {
          return res.status(500).send(
            "Erreur de session."
          );
        }

        try {
          await syncDriveResources();
        } catch (syncError) {
          console.error(
            "[Drive] Première synchronisation impossible :",
            syncError.message
          );
        }

        res.redirect("/pages/admin.html");
      });

    } catch (error) {
      console.error(
        "[Google OAuth]",
        error.message
      );

      res.status(500).send(
        "Connexion Google Drive impossible."
      );
    }
  }
);

// ======================================================
// 18. STATUT GOOGLE DRIVE
// ======================================================

app.get(
  "/api/admin/drive-status",
  requireAdmin,
  (req, res) => {
    const tokens = getSavedTokens();

    res.set("Cache-Control", "no-store");

    res.json({
      configured: driveConfigured,
      connected: Boolean(tokens?.refresh_token),
      syncing: Boolean(syncPromise),
      lastSync: lastSuccessfulSync,
      lastSyncError
    });
  }
);

// ======================================================
// 19. RESSOURCES PUBLIQUES
// ======================================================

app.get("/api/resources", async (req, res) => {
  try {
    if (
      driveConfigured &&
      getSavedTokens()?.refresh_token
    ) {
      try {
        await syncIfDue();
      } catch (error) {
        console.error(
          "[Drive] Catalogue précédent conservé :",
          error.message
        );
      }
    }

    res.set("Cache-Control", "no-store");

    res.json(
      readResources().map(safeResource)
    );

  } catch (error) {
    console.error(
      "[Resources]",
      error.message
    );

    res.status(500).json({
      error: "Impossible de lire les ressources."
    });
  }
});

app.get("/api/resources/:id", async (req, res) => {
  try {
    const resource = readResources().find(
      item => item.id === req.params.id
    );

    if (!resource) {
      return res.status(404).json({
        error: "Ressource introuvable."
      });
    }

    res.set("Cache-Control", "no-store");

    res.json(safeResource(resource));

  } catch (error) {
    res.status(500).json({
      error: "Impossible de lire cette ressource."
    });
  }
});

// ======================================================
// 20. UPLOAD DEPUIS LE SITE
// ======================================================

app.post(
  "/api/admin/upload",
  requireAdmin,
  upload.single("file"),
  async (req, res) => {
    let uploadedDriveFileId = null;

    try {
      if (!req.file) {
        return res.status(400).json({
          error: "Aucun fichier reçu."
        });
      }

      const {
        id,
        title,
        description,
        year,
        semester,
        category
      } = req.body;

      const cleanTitle = String(title || "").trim();
      const cleanYear = String(year || "").trim();
      const cleanSemester = String(semester || "").trim();
      const cleanCategory = normalizeCategory(category);

      if (!cleanTitle) {
        return res.status(400).json({
          error: "Le titre est obligatoire."
        });
      }

      if (!ALLOWED_YEARS.includes(cleanYear)) {
        return res.status(400).json({
          error: "Année invalide."
        });
      }

      if (!SEMESTERS[cleanSemester]) {
        return res.status(400).json({
          error: "Semestre invalide."
        });
      }

      if (!CATEGORIES.includes(cleanCategory)) {
        return res.status(400).json({
          error: "Catégorie invalide."
        });
      }

      const resources = readResources();

      const existing = id
        ? resources.find(item => item.id === id)
        : null;

      if (id && !existing) {
        return res.status(404).json({
          error: "Ressource à remplacer introuvable."
        });
      }

      const drive = getDrive();

      const folderId = await getDestinationFolder(
        drive,
        cleanSemester,
        cleanCategory
      );

      const fileName = cleanFileName(
        req.file.originalname
      );

      const uploaded = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [folderId]
        },

        media: {
          mimeType: req.file.mimetype,
          body: Readable.from(req.file.buffer)
        },

        fields: "id,name,mimeType,size,modifiedTime",

        supportsAllDrives: true
      });

      uploadedDriveFileId = uploaded.data.id;

      const now = new Date().toISOString();

      const resource = {
        id: existing?.id || crypto.randomUUID(),

        title: cleanTitle,
        description: String(description || "").trim(),

        year: cleanYear,
        semester: cleanSemester,
        category: cleanCategory,

        fileName,

        fileSize: Number(
          uploaded.data.size || req.file.size
        ),

        mimeType:
          uploaded.data.mimeType ||
          req.file.mimetype,

        driveFileId: uploaded.data.id,

        addedAt: existing?.addedAt || now,
        updatedAt: now
      };

      const updatedResources = existing
        ? resources.map(item =>
            item.id === existing.id
              ? resource
              : item
          )
        : [resource, ...resources];

      saveResources(updatedResources);

      if (
        existing?.driveFileId &&
        existing.driveFileId !== uploaded.data.id
      ) {
        try {
          await drive.files.delete({
            fileId: existing.driveFileId,
            supportsAllDrives: true
          });
        } catch (error) {
          console.error(
            "Ancien fichier non supprimé :",
            error.message
          );
        }
      }

      lastSuccessfulSync = now;

      res.status(201).json({
        success: true,
        resource: safeResource(resource)
      });

    } catch (error) {
      console.error(
        "[Upload]",
        error.message
      );

      if (uploadedDriveFileId) {
        try {
          await getDrive().files.delete({
            fileId: uploadedDriveFileId,
            supportsAllDrives: true
          });
        } catch (cleanupError) {
          console.error(
            "Nettoyage impossible :",
            cleanupError.message
          );
        }
      }

      res.status(500).json({
        error: "Échec de l'envoi vers Google Drive."
      });
    }
  }
);

// ======================================================
// 21. TÉLÉCHARGEMENT / PRÉVISUALISATION
// ======================================================

app.get(
  "/api/resources/:id/file",
  async (req, res) => {
    try {
      const resource = readResources().find(
        item => item.id === req.params.id
      );

      if (!resource) {
        return res.status(404).send(
          "Ressource introuvable."
        );
      }

      if (!resource.driveFileId) {
        return res.status(404).send(
          "Fichier Drive introuvable."
        );
      }

      const drive = getDrive();

      const response = await drive.files.get(
        {
          fileId: resource.driveFileId,
          alt: "media",
          supportsAllDrives: true
        },
        {
          responseType: "stream"
        }
      );

      const fileName = cleanFileName(
        resource.fileName || "document"
      );

      const disposition =
        req.query.download === "1"
          ? "attachment"
          : "inline";

      res.setHeader(
        "Content-Type",
        resource.mimeType || "application/octet-stream"
      );

      res.setHeader(
        "Content-Disposition",
        `${disposition}; filename*=UTF-8''${encodeURIComponent(fileName)}`
      );

      res.setHeader(
        "X-Content-Type-Options",
        "nosniff"
      );

      res.setHeader(
        "Cache-Control",
        "private, no-store"
      );

      response.data.on("error", error => {
        console.error(
          "[Download]",
          error.message
        );

        if (!res.headersSent) {
          res.status(502);
        }

        res.end();
      });

      response.data.pipe(res);

    } catch (error) {
      console.error(
        "[Download]",
        error.message
      );

      if (!res.headersSent) {
        res.status(
          isGoogleNotFound(error) ? 404 : 502
        ).send(
          isGoogleNotFound(error)
            ? "Le fichier n'existe plus dans Drive."
            : "Impossible de récupérer le fichier."
        );
      }
    }
  }
);

// ======================================================
// 22. SUPPRESSION D'UNE RESSOURCE
// ======================================================

app.delete(
  "/api/admin/resources/:id",
  requireAdmin,
  async (req, res) => {
    try {
      const resources = readResources();

      const resource = resources.find(
        item => item.id === req.params.id
      );

      if (!resource) {
        return res.status(404).json({
          error: "Ressource introuvable."
        });
      }

      if (resource.driveFileId) {
        const drive = getDrive();

        try {
          await drive.files.delete({
            fileId: resource.driveFileId,
            supportsAllDrives: true
          });
        } catch (error) {
          if (!isGoogleNotFound(error)) {
            throw error;
          }
        }
      }

      saveResources(
        resources.filter(
          item => item.id !== resource.id
        )
      );

      lastSuccessfulSync = new Date().toISOString();

      res.json({
        success: true
      });

    } catch (error) {
      console.error(
        "[Delete]",
        error.message
      );

      res.status(500).json({
        error: "Suppression impossible."
      });
    }
  }
);

// ======================================================
// 23. ERREURS
// ======================================================

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof multer.MulterError) {
    return res.status(
      error.code === "LIMIT_FILE_SIZE" ? 413 : 400
    ).json({
      error:
        error.code === "LIMIT_FILE_SIZE"
          ? "Fichier trop volumineux : maximum 50 Mo."
          : "Erreur lors de l'envoi."
    });
  }

  if (error.message === "Format de fichier non autorisé.") {
    return res.status(400).json({
      error: error.message
    });
  }

  console.error(
    "[Server]",
    error.message
  );

  res.status(500).json({
    error: "Erreur interne du serveur."
  });
});

// ======================================================
// 24. DÉMARRAGE
// ======================================================

const server = app.listen(PORT, HOST, () => {
  console.log("--------------------------------");
  console.log("MECANIQUE PLATFORM");
  console.log(`http://${HOST}:${PORT}`);
  console.log("--------------------------------");

  console.log(
    "Architecture Drive : Semestre / Catégorie"
  );

  console.log(
    `Synchronisation automatique : ${SYNC_INTERVAL_MS / 1000} secondes`
  );

  if (
    driveConfigured &&
    getSavedTokens()?.refresh_token
  ) {
    syncDriveResources().catch(error => {
      console.error(
        "[Drive] Synchronisation initiale :",
        error.message
      );
    });
  } else {
    console.log(
      "Google Drive non connecté. Vérifie la connexion Google."
    );
  }
});

// Synchronisation automatique toutes les 60 secondes.
const syncTimer = setInterval(() => {
  if (
    !driveConfigured ||
    !getSavedTokens()?.refresh_token
  ) {
    return;
  }

  syncDriveResources().catch(error => {
    console.error(
      "[Drive] Synchronisation automatique :",
      error.message
    );
  });
}, SYNC_INTERVAL_MS);

syncTimer.unref();

function shutdown() {
  clearInterval(syncTimer);

  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
