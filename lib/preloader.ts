const preloaderSessionKey = "meshmind:preloader:v1";
const preloaderTimeoutEvent = "meshmind:preloader-timeout";

const preloaderInitializationScript = `
  (() => {
    const root = document.documentElement;
    const sessionKey = ${JSON.stringify(preloaderSessionKey)};
    const timeoutEvent = ${JSON.stringify(preloaderTimeoutEvent)};

    try {
      if (sessionStorage.getItem(sessionKey) === "1") return;
      sessionStorage.setItem(sessionKey, "1");
    } catch {}

    root.dataset.preloaderActive = "true";

    let observer;
    const isolateContent = () => {
      const content = document.querySelector("[data-app-content]");
      if (!content) return false;
      content.setAttribute("inert", "");
      content.setAttribute("aria-hidden", "true");
      return true;
    };

    if (!isolateContent()) {
      observer = new MutationObserver(() => {
        if (isolateContent()) observer.disconnect();
      });
      observer.observe(root, { childList: true, subtree: true });
    }

    const scheduleFailOpen = () => {
      setTimeout(() => {
        observer?.disconnect();
        if (root.dataset.preloaderActive !== "true") return;

        root.removeAttribute("data-preloader-active");
        const content = document.querySelector("[data-app-content]");
        content?.removeAttribute("inert");
        content?.removeAttribute("aria-hidden");
        document.body?.style.removeProperty("overflow");
        document.body?.removeAttribute("aria-busy");
        window.dispatchEvent(new Event(timeoutEvent));
      }, 5000);
    };

    if (document.readyState === "complete") {
      scheduleFailOpen();
    } else {
      window.addEventListener("load", scheduleFailOpen, { once: true });
    }
  })();
`;

export {
  preloaderInitializationScript,
  preloaderSessionKey,
  preloaderTimeoutEvent,
};
