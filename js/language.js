```javascript
const translations = {
  fr: {
    brandSubtitle: "Espace pédagogique",
    navHome: "Accueil",
    navResources: "Ressources",
    navAdmin: "Administration",
    navExplore: "Explorer les cours",
    heroEyebrow: "APPRENDRE · PRATIQUER · PROGRESSER",
    heroTitle: 'La mécanique, <br><span>plus claire</span> chaque jour.',
    heroDescription: "Un espace pédagogique pour retrouver facilement vos cours, travaux dirigés, travaux pratiques et corrigés, organisés par année et par semestre.",
    heroExplore: "Explorer les ressources",
    heroDiscover: "Découvrir l’espace",
    heroNote: "Des ressources classées, accessibles en quelques clics.",
    visualTitle: "Un seul espace",
    visualSubtitle: "Pour toutes vos ressources",
    levelsEyebrow: "VOTRE PARCOURS",
    levelsTitle: "Choisissez votre année",
    levelsDescription: "Accédez aux ressources correspondant à votre niveau scolaire.",
    allResources: "Toutes les ressources",
    firstYear: "PREMIÈRE ANNÉE",
    secondYear: "DEUXIÈME ANNÉE",
    thirdYear: "TROISIÈME ANNÉE",
    firstYearDescription: "Les bases et les notions essentielles pour bien commencer.",
    secondYearDescription: "Approfondissez les méthodes et entraînez-vous régulièrement.",
    thirdYearDescription: "Consolidez vos acquis et préparez vos évaluations.",
    accessResources: "Accéder aux ressources",
    methodsEyebrow: "LES RESSOURCES",
    methodsTitle: "Tout pour apprendre à votre rythme",
    methodsDescription: "Quatre formats complémentaires pour comprendre, appliquer et réviser.",
    courseTitle: "Cours",
    courseDescription: "Retrouvez les notions, définitions, lois et formules importantes.",
    tdDescription: "Entraînez-vous avec des exercices pour appliquer le cours.",
    tpDescription: "Explorez les applications pratiques et les activités expérimentales.",
    correctionTitle: "Corrigés",
    correctionDescription: "Vérifiez votre démarche et comprenez les étapes de résolution.",
    latestEyebrow: "MIS À JOUR",
    latestTitle: "Dernières ressources ajoutées",
    latestDescription: "Les documents les plus récents publiés dans l’espace pédagogique.",
    seeAll: "Voir tout",
    loadingResources: "Chargement des ressources…",
    ctaEyebrow: "PRÊT À COMMENCER ?",
    ctaTitle: "Votre prochaine révision commence ici.",
    ctaDescription: "Choisissez votre niveau et retrouvez les documents dont vous avez besoin.",
    ctaButton: "Parcourir les ressources",
    footerDescription: "Un espace simple pour apprendre, pratiquer et progresser.",
    footerNote: "Conçu pour accompagner votre apprentissage."
  },

  ar: {
    brandSubtitle: "الفضاء التعليمي",
    navHome: "الرئيسية",
    navResources: "الموارد",
    navAdmin: "الإدارة",
    navExplore: "استكشاف الدروس",
    heroEyebrow: "تعلّم · طبّق · تقدّم",
    heroTitle: 'الميكانيك،<br><span>أكثر وضوحًا</span> كل يوم.',
    heroDescription: "فضاء تعليمي يتيح لك الوصول بسهولة إلى الدروس والأعمال الموجّهة والتطبيقية والتصحيحات، حسب السنة والفصل الدراسي.",
    heroExplore: "استكشاف الموارد",
    heroDiscover: "اكتشف المنصة",
    heroNote: "موارد منظّمة يمكنك الوصول إليها ببضع نقرات.",
    visualTitle: "فضاء واحد",
    visualSubtitle: "لجميع مواردك التعليمية",
    levelsEyebrow: "مسارك الدراسي",
    levelsTitle: "اختر سنتك الدراسية",
    levelsDescription: "اكتشف الموارد المناسبة لمستواك الدراسي.",
    allResources: "جميع الموارد",
    firstYear: "السنة الأولى",
    secondYear: "السنة الثانية",
    thirdYear: "السنة الثالثة",
    firstYearDescription: "تعرّف على الأساسيات والمفاهيم الضرورية للانطلاق.",
    secondYearDescription: "عمّق معارفك وتدرّب بانتظام على التمارين.",
    thirdYearDescription: "عزّز مكتسباتك واستعدّ للتقييمات والامتحانات.",
    accessResources: "الوصول إلى الموارد",
    methodsEyebrow: "الموارد التعليمية",
    methodsTitle: "تعلّم وفق وتيرتك الخاصة",
    methodsDescription: "أربعة أنواع من الموارد للفهم والتطبيق والمراجعة.",
    courseTitle: "الدروس",
    courseDescription: "اكتشف المفاهيم والتعريفات والقوانين والصيغ الأساسية.",
    tdDescription: "تدرّب على تمارين لتطبيق ما تعلمته في الدروس.",
    tpDescription: "اكتشف التطبيقات العملية والأنشطة التجريبية.",
    correctionTitle: "التصحيحات",
    correctionDescription: "راجع خطوات الحل وافهم طريقة الوصول إلى النتيجة.",
    latestEyebrow: "تحديثات",
    latestTitle: "أحدث الموارد المضافة",
    latestDescription: "أحدث الوثائق المنشورة في الفضاء التعليمي.",
    seeAll: "عرض الكل",
    loadingResources: "جارٍ تحميل الموارد…",
    ctaEyebrow: "هل أنت مستعد للبدء؟",
    ctaTitle: "مراجعتك القادمة تبدأ من هنا.",
    ctaDescription: "اختر سنتك الدراسية واعثر على الوثائق التي تحتاج إليها.",
    ctaButton: "تصفّح الموارد",
    footerDescription: "فضاء بسيط للتعلّم والتطبيق والتقدّم.",
    footerNote: "منصة لمرافقتك في مسيرتك التعليمية."
  }
};

function changeLanguage(lang) {
  if (!translations[lang]) return;

  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";

  document.querySelectorAll("[data-i18n]").forEach(element => {
    const key = element.dataset.i18n;
    const value = translations[lang][key];

    if (value !== undefined) {
      element.innerHTML = value;
    }
  });

  document.querySelectorAll("[data-lang]").forEach(button => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.lang === lang)
    );
  });

  localStorage.setItem("siteLanguage", lang);
}

document.querySelectorAll("[data-lang]").forEach(button => {
  button.addEventListener("click", () => {
    changeLanguage(button.dataset.lang);
  });
});

const savedLanguage = localStorage.getItem("siteLanguage") || "fr";
changeLanguage(savedLanguage);
```