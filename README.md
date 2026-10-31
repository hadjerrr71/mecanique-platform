# Mécanique | Espace pédagogique

Application pédagogique responsive développée uniquement en HTML5, CSS3 et JavaScript vanilla. Aucun framework, aucune compilation et aucune dépendance externe.

## Structure

```text
mecanique-platform/
├── index.html
├── pages/
│   ├── ressources.html
│   └── admin.html
├── css/
│   ├── style.css
│   ├── ressources.css
│   └── admin.css
├── js/
│   ├── main.js
│   ├── ressources.js
│   ├── admin.js
│   └── storage.js
├── assets/
│   ├── images/
│   └── icons/
└── README.md
```

## Ouvrir et tester

**Recommandé : utiliser un serveur HTTP local léger** (Python est uniquement un outil de lancement, il n'est pas une dépendance de l'application).

1. Décompresse `mecanique-platform.zip`.
2. Ouvre le terminal dans le dossier `mecanique-platform`.
3. Lance `python -m http.server 8000` (sur certaines installations Windows, utilise `py -m http.server 8000`).
4. Ouvre `http://localhost:8000` dans Chrome, Edge ou Firefox.
5. Pour gérer les documents, ouvre **Administration** ou visite `http://localhost:8000/pages/admin.html`.
6. Ajoute un document, reviens à Ressources, essaie les filtres, la recherche, Télécharger et Consulter. Actualise la page pour vérifier la persistance.
7. Arrête le serveur avec `Ctrl+C` dans le terminal.

L'application peut parfois s'ouvrir en double-cliquant sur `index.html`, mais le comportement d'IndexedDB avec les URL `file://` dépend du navigateur. Le serveur HTTP local est plus fiable. Aucun serveur Node.js n'est requis.

## Fonctionnalités

- Navigation 1AS / 2AS / 3AS, trois semestres et quatre catégories par semestre.
- Recherche par titre et filtres combinables sur année, semestre et catégorie.
- Import, modification des métadonnées, remplacement du fichier, suppression avec confirmation.
- Conservation des fichiers et métadonnées dans IndexedDB après actualisation.
- Téléchargement de tous les formats acceptés et prévisualisation intégrée du PDF et des images lorsque le navigateur l'autorise.
- Responsive ordinateur, tablette et téléphone, navigation mobile, messages de validation et d'erreur.

## Formats et stockage

Formats acceptés : PDF, DOC, DOCX, PPT, PPTX, JPG, JPEG, PNG et WEBP. Taille maximale appliquée par fichier : 50 Mo (la capacité totale réelle dépend du navigateur, du profil et de l'espace disque).

Les fichiers binaires sont enregistrés dans IndexedDB, et non dans `localStorage`. Les ressources restent dans le profil de navigateur et sur l'appareil où elles ont été ajoutées. Elles **ne sont pas synchronisées ni partagées automatiquement** avec les élèves ou d'autres appareils. Effacer les données du site ou le profil du navigateur peut supprimer ces documents. Cette version n'inclut ni compte sécurisé, ni authentification administrateur, ni serveur, ni sauvegarde distante. La page d'administration n'est donc pas protégée contre les visiteurs qui ont accès au site local. Pour un vrai site public partagé, il faudra ajouter un backend avec authentification et stockage distant.

## Notes

- Les ressources sont initialement vides : aucun faux document de cours n'est préchargé.
- Les formats DOC/DOCX/PPT/PPTX ne sont pas garantis en prévisualisation native par les navigateurs ; ils peuvent être téléchargés. Les PDF et images sont prévisualisables quand le navigateur le permet.
- `assets/images/` et `assets/icons/` sont prévus pour de futurs médias locaux. Le design actuel utilise du CSS et des caractères Unicode, sans charger de bibliothèque d'icônes distante.
