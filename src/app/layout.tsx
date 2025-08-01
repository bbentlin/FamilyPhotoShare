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
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📸</text></svg>"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function initTheme() {
                  try {
                    // Wait for DOM to be ready
                    if (!document.documentElement) {
                      setTimeout(initTheme, 10);
                      return;
                    }
                    
                    var theme = localStorage.getItem('theme') || 'system';
                    var effectiveTheme = theme;
                    
                    if (theme === 'system') {
                      var isDark = false;
                      
                      // Standard check
                      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                        isDark = true;
                      }
                      
                      effectiveTheme = isDark ? 'dark' : 'light';
                    }
                    
                    // Apply theme safely
                    var root = document.documentElement;
                    if (root && root.classList) {
                      root.classList.remove('light', 'dark');
                      root.classList.add(effectiveTheme);
                      root.style.setProperty('color-scheme', effectiveTheme);
                    }
                    
                  } catch (e) {
                    console.warn('Theme initialization failed:', e);
                    // Fallback to light theme
                    if (document.documentElement && document.documentElement.classList) {
                      document.documentElement.classList.add('light');
                    }
                  }
                }
                
                // Initialize immediately or wait for DOM
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', initTheme);
                } else {
                  initTheme();
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
