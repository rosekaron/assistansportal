/** @type {import('tailwindcss').Config} */
export default {
  // No darkMode — we use a light, accessible theme
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary:     { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary:   { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted:       { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent:      { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        card:        { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover:     { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontSize: {
        // Slightly larger scale for accessibility
        xs:   ["0.8rem",  { lineHeight: "1.4" }],
        sm:   ["0.9rem",  { lineHeight: "1.5" }],
        base: ["1rem",    { lineHeight: "1.6" }],
        lg:   ["1.125rem",{ lineHeight: "1.6" }],
        xl:   ["1.25rem", { lineHeight: "1.5" }],
        "2xl":["1.5rem",  { lineHeight: "1.4" }],
        "3xl":["1.875rem",{ lineHeight: "1.3" }],
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up":   { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
      },
      boxShadow: {
        // Soft, calm shadows
        sm:  "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        md:  "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)",
        lg:  "0 8px 24px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.04)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
