/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      screens: {
        // Context margin sits beside the article instead of over it.
        wide: "1400px",
        // Sidebar shows labels.
        xwide: "1720px",
      },
      fontFamily: {
        display: ["var(--font-poppins)", "system-ui", "sans-serif"],
        body: ["var(--font-roboto)", "system-ui", "sans-serif"],
      },
      colors: {
        border: "var(--border)",
        background: "var(--background)",
        "background-secondary": "var(--background-secondary)",
        surface: "var(--surface)",
        foreground: "var(--foreground)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",
        divider: "var(--divider)",
        "accent-primary": "var(--accent-primary)",
        "accent-secondary": "var(--accent-secondary)",
        "on-accent": "var(--on-accent)",
        "entity-highlight": "var(--entity-highlight)",
        "entity-highlight-active": "var(--entity-highlight-active)",
        "entity-person": "var(--entity-person)",
        "entity-organization": "var(--entity-organization)",
        "entity-event": "var(--entity-event)",
        "entity-concept": "var(--entity-concept)",
        "entity-location": "var(--entity-location)",
        success: "var(--success)",
        error: "var(--error)",
      },
      maxWidth: {
        measure: "68ch",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
