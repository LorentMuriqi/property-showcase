import { useEffect } from "react";
import { Helmet } from "react-helmet-async";

// Hook për SEO të thjeshtë — përdoret në çdo faqe
export function useSEO({
  title,
  description,
  image,
  url,
  type = "website",
}: {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: "website" | "article";
}) {
  const siteName = "Aura Estates";
  const fullTitle = title.includes(siteName) ? title : `${title} | ${siteName}`;
  const defaultImage = "/images/hero-bg.png";
  const finalImage = image || defaultImage;

  return { fullTitle, description, finalImage, url, type, siteName };
}