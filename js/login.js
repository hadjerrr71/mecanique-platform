
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form");

  if (!form) {
    console.error("Formulaire de connexion introuvable.");
    return;
  }

  const emailInput =
    form.querySelector('input[type="email"]') ||
    form.querySelector('input[name="email"]');

  const passwordInput =
    form.querySelector('input[type="password"]') ||
    form.querySelector('input[name="password"]');

  const submitButton = form.querySelector(
    'button[type="submit"], input[type="submit"]'
  );

  let message = document.querySelector("#login-message");

  if (!message) {
    message = document.createElement("p");
    message.id = "login-message";
    message.setAttribute("role", "status");
    form.appendChild(message);
  }

  if (!emailInput || !passwordInput) {
    message.textContent =
      "Les champs email ou mot de passe sont introuvables.";
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    message.textContent = "";

    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: emailInput.value.trim(),
          password: passwordInput.value
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Email ou mot de passe incorrect."
        );
      }

      // Vérifier que le serveur reconnaît réellement la session.
      const statusResponse = await fetch("/api/admin/status", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store"
      });

      const status = await statusResponse.json();

      if (!statusResponse.ok || !status.authenticated) {
        throw new Error(
          "La session n'a pas été conservée par le serveur."
        );
      }

      window.location.replace("/pages/admin.html");
    } catch (error) {
      console.error("Erreur de connexion :", error);
      message.textContent =
        error.message || "Impossible de se connecter.";
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
});
