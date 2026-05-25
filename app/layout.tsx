import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { createClient } from "@/lib/supabase/server";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FoodSource – Restaurant & Supplier Marketplace",
  description:
    "A two-sided marketplace connecting restaurant owners with food suppliers.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialNotifications: { id: string; title: string; message: string; is_read: boolean; created_at: string; link: string | null }[] = [];
  if (user) {
    const { data } = await supabase
      .from("notifications")
      .select("id, title, message, is_read, created_at, link")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    initialNotifications = data ?? [];
  }

  return (
    <html lang="en" className={inter.variable}>
      <body className="flex flex-col min-h-screen">
        <Navbar user={user} initialNotifications={initialNotifications} />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
