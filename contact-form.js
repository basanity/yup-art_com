const form = document.getElementById("contact-form");
const submit = form.querySelector('button[type="submit"]');
const error = document.getElementById("form-error");
const success = document.getElementById("contact-success");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submit.disabled) return;
  submit.disabled = true;
  error.hidden = true;

  try {
    const data = Object.fromEntries(new FormData(form));
    if (!data["cf-turnstile-response"]) throw new Error("Verification is not ready");

    const response = await fetch("https://basanity-contact.basanity.workers.dev", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok || result.ok !== true) throw new Error("Contact submission failed");

    form.reset();
    form.hidden = true;
    success.hidden = false;
    success.focus();
  } catch {
    error.hidden = false;
    submit.disabled = false;
    window.turnstile?.reset();
  }
});
