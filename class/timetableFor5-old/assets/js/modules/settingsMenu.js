export function installSettingsMenuHandlers({
  document,
  reportUrl,
  openModalById,
  openTermsView,
  openSubjectSetup,
  openClassSetup,
}) {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    const id = button.id;
    if (!id) return;

    if (id === "history" || id === "help" || id === "setting" || id === "source" || id === "issues" || id === "detail") {
      try {
        // Optional: analytics
        if (typeof window.gtag === "function") {
          window.gtag("event", "open_modal", { modal_id: id });
        }
      } catch {
        // ignore
      }
      event.preventDefault();
      openModalById?.(id);
      return;
    }

    if (id === "subject-setup") {
      event.preventDefault();
      openSubjectSetup?.();
      return;
    }

    if (id === "class-setup") {
      event.preventDefault();
      openClassSetup?.();
      return;
    }

    if (id === "terms") {
      event.preventDefault();
      openTermsView?.();
      return;
    }

    if (id === "report") {
      event.preventDefault();
      window.open(reportUrl, "_blank");
    }
  });
}
