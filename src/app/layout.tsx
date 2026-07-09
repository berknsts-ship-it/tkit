import type { Metadata, Viewport } from "next";
import { Lora, Nunito } from "next/font/google";
import "./globals.css";
import BackgroundDecor from "@/components/BackgroundDecor";

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin", "cyrillic"],
  style: ["normal", "italic"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "cyrillic"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "T-Kit — платформа для репетиторов",
  description: "Расписание, домашние задания, интерактивная доска и словарь — всё для онлайн-репетитора в одном месте",
  openGraph: {
    title: "T-Kit — платформа для репетиторов",
    description: "Расписание, домашние задания, интерактивная доска и словарь — всё в одном месте",
    siteName: "T-Kit",
    locale: "ru_RU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "T-Kit — платформа для репетиторов",
    description: "Расписание, домашние задания, интерактивная доска и словарь — всё в одном месте",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "T-Kit",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${lora.variable} ${nunito.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <style dangerouslySetInnerHTML={{ __html: `
          #page-loader { position:fixed; inset:0; z-index:99999; display:flex; align-items:center; justify-content:center; background:#fdf8f0; }
          #page-loader::after { content:''; width:36px; height:36px; border:3px solid #e8d5b0; border-top-color:#7a4a1e; border-radius:50%; animation:spin .7s linear infinite; }
          @keyframes spin { to { transform:rotate(360deg); } }
          body.loaded #page-loader { display:none; }
        `}} />
        <div id="page-loader" />
        <script dangerouslySetInnerHTML={{ __html: `document.addEventListener('DOMContentLoaded', function(){ document.body.classList.add('loaded'); });` }} />
        <BackgroundDecor />
        <div className="relative flex flex-col flex-1" style={{ zIndex: 1 }}>{children}</div>
      </body>
    </html>
  );
}
