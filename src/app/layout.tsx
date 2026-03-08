import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { cookies } from "next/headers";
import { SessionProvider } from "next-auth/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "KeyHub - AI API Gateway",
  description:
    "Self-hosted OpenRouter alternative. Manage provider keys, generate virtual API keys, and track usage across AI providers.",
};

function resolveThemeClass(cookie: string | undefined): string {
  if (cookie === "light") return "light";
  if (cookie === "system") return ""; // let client JS handle system preference
  return "dark"; // default
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("keyhub-theme")?.value;
  const themeClass = resolveThemeClass(themeCookie);

  return (
    <html lang="en" className={cn(themeClass, "font-sans", geist.variable)}>
      <body className={`${geist.className} antialiased`}>
        <SessionProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
