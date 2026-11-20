"use client";

/**
 * First focusable element of the merchant dashboard: lets keyboard users jump past the sidebar and header (about fifteen
 * tab stops) straight to the page content. Hidden until it receives focus. Selecting it moves focus to <main id="main">,
 * so the next Tab lands on the first control of the page, not back in the sidebar.
 */
export function SkipLink() {
  return (
    <a
      href="#main"
      onClick={(e) => {
        const main = document.getElementById("main");
        if (!main) return;
        e.preventDefault();
        main.tabIndex = -1; // focusable by script only; not added to the tab order
        main.focus();
        main.scrollIntoView({ block: "start" });
      }}
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      Skip to main content
    </a>
  );
}
