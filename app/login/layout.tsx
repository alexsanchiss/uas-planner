import type { Metadata } from "next";
import { defaultLanguage, getTranslation } from "@/app/i18n/translations";

export const metadata: Metadata = {
  title: getTranslation(defaultLanguage).titles.login,
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
