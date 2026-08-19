import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import VisitTracker from "@/components/VisitTracker";

export const metadata: Metadata = {
  title: "Tyaga Pyriatyn — кальян-лаунж",
  description:
    "Tyaga Pyriatyn — кальян-лаунж у Пирятині. Бронювання столиків, каталог смаків тютюну та замовлення забивки на самовивіз.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="uk" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <VisitTracker />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
