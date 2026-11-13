/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    // Square corners everywhere, as in print. `rounded-full` stays for dots and avatars.
    borderRadius: {
      none: "0",
      DEFAULT: "0",
      sm: "0",
      md: "0",
      lg: "0",
      xl: "0",
      "2xl": "0",
      "3xl": "0",
      full: "9999px",
    },
    extend: {
      screens: {
        // Context margin sits beside the article instead of over it
        // (1400px of reader plus the 72px nav rail).
        wide: "1480px",
        // The nav rail shows labels.
        xwide: "1720px",
      },
      // Broadsheet type: a serif for anything you read, a small sans for anything you operate.
      fontFamily: {
        editorial: ["Georgia", '"Times New Roman"', "serif"],
        ui: ["Arial", "Helvetica", "sans-serif"],
      },
      letterSpacing: {
        // Uppercase interface labels.
        label: "0.13em",
        kicker: "0.15em",
        // Large serif headlines.
        headline: "-0.035em",
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
