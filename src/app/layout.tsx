import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import ClientOnly from "@/components/ClientOnly";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext"; 
import ConditionalNavbar from "@/components/ConditionalNavbar";
import { DemoProvider } from "@/context/DemoContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Family Photo Share",
  description: "Share photos with your family",
  icons: { icon: "/familylogo.png" },
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
                    if (!document.documentElement) {
                      setTimeout(initTheme, 10);
                      return;
                    }
                    
                    var theme = localStorage.getItem('theme') || 'system';
                    var effectiveTheme = theme;
                    
                    if (theme === 'system') {
                      var isDark = false;
                      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                        isDark = true;
                      }
                      effectiveTheme = isDark ? 'dark' : 'light';
                    }
                    
                    var root = document.documentElement;
                    if (root && root.classList) {
                      root.classList.remove('light', 'dark');
                      root.classList.add(effectiveTheme);
                      root.style.setProperty('color-scheme', effectiveTheme);
                    }
                  } catch (e) {
                    console.warn('Theme initialization failed:', e);
                    if (document.documentElement && document.documentElement.classList) {
                      document.documentElement.classList.add('light');
                    }
                  }
                }
                
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
        <ClientOnly fallback={<div>Loading...</div>}>
          <ThemeProvider>
            {" "}
            <AuthProvider>
              <DemoProvider>
                <ConditionalNavbar />
                {children}
                <Toaster
                  position="top-right"
                  toastOptions={{
                    duration: 4000,
                    style: {
                      background: "var(--toast-bg)",
                      color: "var(--toast-color)",
                    },
                  }}
                />
              </DemoProvider>
            </AuthProvider>
          </ThemeProvider>{" "}
        </ClientOnly>
      </body>
    </html>
  );
}
