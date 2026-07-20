"use client";

import { useEffect, useRef } from "react";

export type CustomEmbed = {
  name: string;
  position: string;
  html: string;
  active: boolean;
};

/**
 * Renders custom embed HTML (scripts, custom elements like TradingView widgets)
 * by injecting it into a container div. Scripts in innerHTML don't execute
 * automatically, so we manually create and append script elements.
 */
export function CustomEmbedRenderer({ html }: { html: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !html.trim()) return;

    // Clear previous content
    container.innerHTML = "";

    // Parse the HTML string
    const template = document.createElement("template");
    template.innerHTML = html.trim();

    // Clone nodes into the container
    const fragment = template.content.cloneNode(true) as DocumentFragment;

    // Find all <script> elements and re-create them (scripts inserted via
    // innerHTML don't execute — we need to manually create them)
    const scripts = fragment.querySelectorAll("script");
    scripts.forEach((oldScript) => {
      const newScript = document.createElement("script");
      // Copy attributes (src, type, async, etc.)
      for (const attr of Array.from(oldScript.attributes)) {
        newScript.setAttribute(attr.name, attr.value);
      }
      // Copy inline script content
      newScript.textContent = oldScript.textContent;
      // Replace the old (non-executing) script with the new one
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    });

    container.appendChild(fragment);
  }, [html]);

  return <div ref={containerRef} className="custom-embed-container" />;
}

/**
 * Renders all active custom embeds for a given position.
 * Filters by position and active status, then renders each embed's HTML.
 */
export function CustomEmbedsForPosition({
  embeds,
  position,
}: {
  embeds: CustomEmbed[];
  position: string;
}) {
  const active = embeds.filter((e) => e.active && e.position === position && e.html.trim());
  if (active.length === 0) return null;

  return (
    <>
      {active.map((embed, i) => (
        <div key={i} className="custom-embed-wrapper" data-embed-name={embed.name}>
          <CustomEmbedRenderer html={embed.html} />
        </div>
      ))}
    </>
  );
}
