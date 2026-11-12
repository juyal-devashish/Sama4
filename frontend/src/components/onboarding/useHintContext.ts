"use client";

import { useEffect, useState } from "react";

/** True while the first-visit splash or intro covers the app (`html.intro`). */
export function useIntroShowing() {
  const [showing, setShowing] = useState(false);
  useEffect(() => {
    const html = document.documentElement;
    const read = () => setShowing(html.classList.contains("intro"));
    read();
    const obs = new MutationObserver(read);
    obs.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return showing;
}

/** Wide enough for the three-pane reader, where keyboard shortcuts make sense. */
export function useDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const read = () => setDesktop(mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);
  return desktop;
}
