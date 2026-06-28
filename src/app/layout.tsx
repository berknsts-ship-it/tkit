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
  appleWebApp: {
    capable: true,
    title: "T-Kit",
    statusBarStyle: "default",
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
        <BackgroundDecor />
        <div className="relative flex flex-col flex-1" style={{ zIndex: 1 }}>{children}</div>
      </body>
    </html>
  );
}
