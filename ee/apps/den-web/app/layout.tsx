import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import { headers } from "next/headers";
import { readPublicWebOrigin } from "./_lib/public-web-origin";
import { denHtmlLang } from "./_lib/i18n/den-locale";
import { createDenT } from "./_lib/i18n/messages";
import { resolveDenLocale, resolveDenLocaleMismatch } from "./_lib/i18n/server";
import { DenLocaleBootstrap, DenMessagesProvider } from "./_lib/i18n/client";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
  weight: ["400", "500"]
});

function metadataBaseFromOrigin(origin: string) {
  try {
    return new URL(origin);
  } catch {
    return new URL("http://localhost:3005");
  }
}

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || "";
}

function forwardedProtocol(value: string | null) {
  const protocol = firstHeaderValue(value).toLowerCase();
  return protocol === "http" || protocol === "https" ? protocol : "https";
}

export async function generateMetadata(): Promise<Metadata> {
  const configuredOrigin = readPublicWebOrigin();
  const requestHeaders = await headers();
  const host = firstHeaderValue(requestHeaders.get("x-forwarded-host")) || firstHeaderValue(requestHeaders.get("host"));
  const protocol = forwardedProtocol(requestHeaders.get("x-forwarded-proto"));
  const metadataOrigin = configuredOrigin || (host ? `${protocol}://${host}` : "http://localhost:3005");

  // Server-component translation: the same tables and the same `t(key, params?)`
  // signature client components reach through useDenT().
  const t = createDenT(await resolveDenLocale());
  const documentTitle = t("denRoot.document.title");

  return {
    metadataBase: metadataBaseFromOrigin(metadataOrigin),
    title: documentTitle,
    description: t("denRoot.document.description"),
    openGraph: {
      title: documentTitle,
      description: t("denRoot.socialGraph.description"),
      images: ["/opengraph-image"]
    },
    twitter: {
      card: "summary_large_image",
      title: documentTitle,
      description: t("denRoot.socialPreview.description"),
      images: ["/opengraph-image"]
    },
    icons: {
      icon: "/openwork-mark.svg"
    }
  };
}

export default async function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  // `en` unless the person picked Simplified Chinese and the denLocaleSelection
  // feature is on; a cookie left behind by a reverted rollout resolves to `en`
  // here and is cleared by DenLocaleBootstrap.
  const locale = await resolveDenLocale();
  const preferenceIsStale = await resolveDenLocaleMismatch();

  return (
    <html lang={denHtmlLang(locale)} className={`${inter.variable} ${ibmPlexMono.variable}`} data-den-locale={locale}>
      <head />
      <body>
        <DenMessagesProvider locale={locale}>
          <DenLocaleBootstrap stale={preferenceIsStale} />
          {children}
        </DenMessagesProvider>
      </body>
    </html>
  );
}
