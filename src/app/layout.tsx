import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import ConditionalNavbar from "@/components/ConditionalNavbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Family Photo Share",
  description: "Share photos with your family",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme') || 'system';
                  var effectiveTheme = theme;
                  
                  if (theme === 'system') {
                    // Enhanced Chrome detection
                    var isChrome = navigator.userAgent.indexOf('Chrome') > -1;
                    var isDark = false;
                    
                    // Method 1: Standard check
                    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                      isDark = true;
                    }
                    
                    // Method 2: Chrome-specific check
                    if (isChrome) {
                      try {
                        var testEl = document.createElement('div');
                        testEl.style.cssText = 'color-scheme: dark; position: absolute; visibility: hidden;';
                        document.documentElement.appendChild(testEl);
                        var computedStyle = window.getComputedStyle(testEl);
                        if (computedStyle.colorScheme === 'dark') {
                          isDark = true;
                        }
                        document.documentElement.removeChild(testEl);
                      } catch(e) {}
                      
                      // Method 3: Check cached value for Chrome
                      var cached = localStorage.getItem('system-theme-cache');
                      if (cached) {
                        isDark = cached === 'dark';
                      }
                    }
                    
                    effectiveTheme = isDark ? 'dark' : 'light';
                    
                    // Cache for Chrome
                    if (isChrome) {
                      localStorage.setItem('system-theme-cache', effectiveTheme);
                    }
                  }
                  
                  // Apply theme
                  var root = document.documentElement;
                  var body = document.body;
                  
                  root.classList.remove('light', 'dark');
                  body.classList.remove('light', 'dark');
                  
                  root.classList.add(effectiveTheme);
                  body.classList.add(effectiveTheme);
                  
                  // Set CSS custom property
                  root.style.setProperty('color-scheme', effectiveTheme);
                  
                } catch (e) {
                  console.warn('Theme initialization failed:', e);
                }
              })();
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            <ConditionalNavbar />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
