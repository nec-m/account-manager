import { Geist, Geist_Mono } from 'next/font/google';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "账号管家 Pro",
  description: "自动化账号与手机号资源管理",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
