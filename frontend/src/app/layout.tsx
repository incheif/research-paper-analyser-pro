import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PaperScope AI — Next-Gen Academic Research Paper Analyser",
  description: "Enterprise-grade RAG paper analysis. Multi-turn conversational chat with verified page citations, automatic executive breakdown, methodology analysis, and BibTeX generator.",
  keywords: ["Research Paper Analyser", "RAG", "Gemini", "Groq", "Llama 3", "Academic AI", "PDF Chat", "BibTeX"],
  authors: [{ name: "Research Paper Analyser Pro" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
