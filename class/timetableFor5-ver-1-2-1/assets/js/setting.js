// Settings modal buttons are loaded via fetch+innerHTML, so scripts inside assets/setting.html won't execute.
// Use event delegation from the main document instead.
(function () {
    const REPORT_URL = "https://forms.gle/KiiEAds2vtjAmsZ97";

    function openModalById(id) {
        if (typeof window.timetableOpenModalById !== "function") {
            console.error("timetableOpenModalById is not available yet");
            return;
        }
        window.timetableOpenModalById(id);
    }

    function openTermsView() {
        if (typeof window.timetableOpenTermsView !== "function") {
            console.error("timetableOpenTermsView is not available yet");
            return;
        }
        window.timetableOpenTermsView();
    }

    function openSubjectSetup() {
        if (typeof window.timetableOpenSubjectSetup !== "function") {
            console.error("timetableOpenSubjectSetup is not available yet");
            return;
        }
        window.timetableOpenSubjectSetup();
    }

    function openClassSetup() {
        if (typeof window.timetableOpenClassSetup !== "function") {
            console.error("timetableOpenClassSetup is not available yet");
            return;
        }
        window.timetableOpenClassSetup();
    }

    document.addEventListener("click", event => {
        const button = event.target.closest("button");
        if (!button) {
            return;
        }

        const id = button.id;
        if (!id) {
            return;
        }

        if (id === "history" || id === "help" || id === "setting" || id === "source" || id === "issues") {
            gtag('event', 'open_modal', {'modal_id': id});
            event.preventDefault();
            openModalById(id);
            return;
        }

        if (id === "subject-setup") {
            event.preventDefault();
            openSubjectSetup();
            return;
        }

        if (id === "class-setup") {
            event.preventDefault();
            openClassSetup();
            return;
        }

        if (id === "terms") {
            event.preventDefault();
            openTermsView();
            return;
        }

        if (id === "report") {
            event.preventDefault();
            window.open(REPORT_URL, "_blank");
        }
    });
})();
