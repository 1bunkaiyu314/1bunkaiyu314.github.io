export function createModalManager({ document }) {
  const template = document.getElementById("modal-template");
  if (!template) {
    throw new Error("modal-template not found");
  }

  function openModal(title, contentHtml, { blocking = false, onAgree = null } = {}) {
    const modal = template.content.cloneNode(true);
    const modalElement = modal.querySelector(".modal");
    if (!modalElement) return null;

    modalElement.querySelector(".modal-title").textContent = title;
    modalElement.querySelector(".modal-body").innerHTML = contentHtml;

    document.body.appendChild(modalElement);
    requestAnimationFrame(() => modalElement.classList.add("show"));

    const closeBtn = modalElement.querySelector(".close-modal");
    if (blocking && closeBtn) {
      closeBtn.style.display = "none";
      document.body.classList.add("blocked");
    }

    closeBtn?.addEventListener("click", () => {
      if (blocking) return;
      modalElement.classList.remove("show");
      setTimeout(() => modalElement.remove(), 250);
      document.body.classList.remove("blocked");
    });

    modalElement.addEventListener("click", (event) => {
      if (event.target?.id === "agree-btn") {
        modalElement.classList.remove("show");
        setTimeout(() => modalElement.remove(), 250);
        document.body.classList.remove("blocked");
        if (typeof onAgree === "function") onAgree();
      }
    });

    modalElement.addEventListener("change", (event) => {
      if (event.target?.id === "agree-check") {
        const btn = modalElement.querySelector("#agree-btn");
        if (btn) btn.disabled = !event.target.checked;
      }
    });

    return modalElement;
  }

  return { openModal };
}
