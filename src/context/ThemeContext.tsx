"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  effectiveTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">(
    "light"
  );
  const [mounted, setMounted] = useState(false);

  // Enhanced system theme detection that works better with Chrome
  const getSystemTheme = useCallback((): "light" | "dark" => {
    if (typeof window === "undefined") return "light";

    // Multiple methods to detect system theme for better Chrome compatibility
    const methods = [
      // Method 1: Standard media query
      () => window.matchMedia("(prefers-color-scheme: dark)").matches,

      // Method 2: Check for CSS custom properties (Chrome sometimes needs this)
      () => {
        const testElement = document.createElement("div");
        testElement.style.cssText = "color-scheme: dark; display: none;";
        document.body.appendChild(testElement);
        const computed = window.getComputedStyle(testElement);
        const result = computed.colorScheme === "dark";
        document.body.removeChild(testElement);
        return result;
      },

      // Method 3: Direct localStorage check with fallback
      () => {
        const savedTheme = localStorage.getItem("system-theme-cache");
        if (savedTheme) return savedTheme === "dark";
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
      },
    ];

    // Try each method and use the first one that gives a definitive result
    for (const method of methods) {
      try {
        const result = method();
        if (typeof result === "boolean") {
          const theme = result ? "dark" : "light";
          // Cache the result for Chrome
          localStorage.setItem("system-theme-cache", theme);
          console.log(
            "System theme detected:",
            theme,
            "via method",
            methods.indexOf(method) + 1
          );
          return theme;
        }
      } catch (e) {
        console.warn("Theme detection method failed:", e);
      }
    }

    // Ultimate fallback
    return "light";
  }, []);

  // Load theme from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("theme") as Theme;
    if (savedTheme && ["light", "dark", "system"].includes(savedTheme)) {
      console.log("Loading saved theme:", savedTheme);
      setTheme(savedTheme);
    } else {
      console.log("No saved theme, defaulting to system");
      setTheme("system");
    }
  }, []);

  // Update effective theme
  const updateEffectiveTheme = useCallback(() => {
    if (!mounted) return;

    let newEffectiveTheme: "light" | "dark";

    if (theme === "system") {
      newEffectiveTheme = getSystemTheme();
    } else {
      newEffectiveTheme = theme;
    }

    console.log("Updating effective theme:", {
      currentTheme: theme,
      newEffectiveTheme,
      userAgent: navigator.userAgent,
      isChrome: navigator.userAgent.includes("Chrome"),
    });

    setEffectiveTheme(newEffectiveTheme);
  }, [theme, mounted, getSystemTheme]);

  // Update theme when theme changes
  useEffect(() => {
    updateEffectiveTheme();
  }, [updateEffectiveTheme]);

  // Listen for system theme changes with multiple event listeners for Chrome compatibility
  useEffect(() => {
    if (!mounted || theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleSystemThemeChange = (e?: MediaQueryListEvent) => {
      console.log("System theme change detected:", e?.matches);
      // Clear cache on system change
      localStorage.removeItem("system-theme-cache");
      // Small delay to ensure Chrome has updated
      setTimeout(() => {
        updateEffectiveTheme();
      }, 100);
    };

    // Method 1: Modern addEventListener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleSystemThemeChange);
    }

    // Method 2: Legacy addListener (for older Chrome versions)
    if (mediaQuery.addListener) {
      mediaQuery.addListener(handleSystemThemeChange);
    }

    // Method 3: Polling fallback for Chrome (as a last resort)
    let pollInterval: NodeJS.Timeout;
    if (navigator.userAgent.includes("Chrome")) {
      let lastKnownTheme = getSystemTheme();
      pollInterval = setInterval(() => {
        const currentTheme = getSystemTheme();
        if (currentTheme !== lastKnownTheme) {
          console.log("Theme change detected via polling:", currentTheme);
          lastKnownTheme = currentTheme;
          handleSystemThemeChange();
        }
      }, 1000); // Check every second
    }

    // Method 4: Visibility change listener (Chrome sometimes needs this)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setTimeout(updateEffectiveTheme, 200);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleSystemThemeChange);
      }
      if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handleSystemThemeChange);
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [theme, mounted, updateEffectiveTheme, getSystemTheme]);

  // Apply theme to document with Chrome-specific handling
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    const body = document.body;

    console.log("Applying theme to DOM:", effectiveTheme);

    // Remove both classes first
    root.classList.remove("light", "dark");
    body.classList.remove("light", "dark");

    // Add the appropriate class
    root.classList.add(effectiveTheme);
    body.classList.add(effectiveTheme);

    // Set CSS custom property for Chrome
    root.style.setProperty("color-scheme", effectiveTheme);

    // Force repaint for Chrome
    if (navigator.userAgent.includes("Chrome")) {
      root.style.display = "none";
      root.offsetHeight; // Trigger reflow
      root.style.display = "";
    }
  }, [effectiveTheme, mounted]);

  const handleSetTheme = (newTheme: Theme) => {
    console.log("Theme manually changed:", { from: theme, to: newTheme });
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);

    // Clear system theme cache when manually changing
    if (newTheme !== "system") {
      localStorage.removeItem("system-theme-cache");
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme: handleSetTheme,
        effectiveTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
