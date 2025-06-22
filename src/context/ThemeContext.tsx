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
  const forceChromethemeRefresh = useCallback(() => {
    if (typeof window === "undefined") return;

    const isChrome = navigator.userAgent.includes("Chrome");
    if (!isChrome) return;

    console.log("🔄 Forcing Chrome theme refresh...");

    // Method 1: Create a new media query
    const newQuery = window.matchMedia("(prefers-color-scheme: dark)");
    console.log("Fresh media query result:", newQuery.matches);

    // Method 2: Clear any inline styles that might interfere
    document.documentElement.removeAttribute("style");

    // Method 3: Force recompute
    const computedStyle = window.getComputedStyle(document.documentElement);
    console.log("Recomputed color-scheme:", computedStyle.colorScheme);

    return newQuery.matches ? "dark" : "light";
  }, []);

  // Update your getSystemTheme function
  const getSystemTheme = useCallback((): "light" | "dark" => {
    if (typeof window === "undefined") return "light";

    const isChrome = navigator.userAgent.includes("Chrome");

    if (isChrome) {
      // Force refresh for Chrome
      const freshResult = forceChromethemeRefresh();
      if (freshResult) return freshResult;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }, [forceChromethemeRefresh]);

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

  // Enhanced system theme change detection for Chrome
  useEffect(() => {
    if (!mounted || theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const isChrome = navigator.userAgent.includes("Chrome");

    const handleSystemThemeChange = (e?: MediaQueryListEvent) => {
      console.log("System theme change detected:", e?.matches);
      // Clear cache on system change
      localStorage.removeItem("system-theme-cache");
      // Small delay to ensure Chrome has updated
      setTimeout(() => {
        updateEffectiveTheme();
      }, 100);
    };

    // Method 1: Standard event listeners
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleSystemThemeChange);
    } else if (mediaQuery.addListener) {
      // Fallback for older browsers
      mediaQuery.addListener(handleSystemThemeChange);
    }

    // Method 2: Polling fallback specifically for Chrome
    let pollInterval: NodeJS.Timeout | null = null;
    if (isChrome) {
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

    // Method 3: Window focus detection (Chrome sometimes updates theme on focus)
    const handleWindowFocus = () => {
      if (isChrome) {
        setTimeout(() => {
          updateEffectiveTheme();
        }, 200);
      }
    };

    // Method 4: Visibility change listener
    const handleVisibilityChange = () => {
      if (!document.hidden && isChrome) {
        setTimeout(updateEffectiveTheme, 200);
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleSystemThemeChange);
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handleSystemThemeChange);
      }

      if (pollInterval) {
        clearInterval(pollInterval);
      }

      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [theme, mounted, updateEffectiveTheme, getSystemTheme]);

  // Apply theme to document with Chrome-specific handling
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    const body = document.body;

    console.log("Applying theme to DOM:", effectiveTheme);

    // Remove existing classes
    root.classList.remove("light", "dark");
    body.classList.remove("light", "dark");

    // Add new class
    root.classList.add(effectiveTheme);
    body.classList.add(effectiveTheme);

    // Set CSS property
    root.style.setProperty("color-scheme", effectiveTheme);
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
