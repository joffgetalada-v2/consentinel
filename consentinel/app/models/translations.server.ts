/**
 * Banner translations (Pro).
 *
 * Two layers combine into the per-locale `i18n` map delivered to the
 * storefront inside the config metafield:
 *   1. A built-in dictionary of the FIXED banner strings (category names,
 *      preferences heading, opt-out texts, the reopen pill) plus translated
 *      defaults for the merchant-editable content fields.
 *   2. A BannerTranslation row per locale with the merchant's (editable)
 *      content strings — seeded from the dictionary when a language is added.
 *
 * The storefront bundle looks up `i18n[locale]` by the visitor's request
 * locale and falls back to English for anything missing, so a partial map
 * can never break the banner.
 *
 * Short keys keep the metafield and bundle lean:
 *   hd heading · bd body · ac accept · rj reject · cu customize
 *   ph prefs heading · sv save button · nn/nd necessary name/desc ·
 *   pn/pd preferences · an/ad analytics · mn/md marketing ·
 *   oh/ob/oo/dm opt-out heading/body/button/dismiss ·
 *   rp reopen pill · pp privacy-policy link
 */
import type { BannerTranslation } from "@prisma/client";
import prisma from "../db.server";

export type { BannerTranslation };

export interface LocaleStrings {
  hd: string;
  bd: string;
  ac: string;
  rj: string;
  cu: string;
  ph: string;
  sv: string;
  nn: string;
  nd: string;
  pn: string;
  pd: string;
  an: string;
  ad: string;
  mn: string;
  md: string;
  oh: string;
  ob: string;
  oo: string;
  dm: string;
  rp: string;
  pp: string;
}

export const SUPPORTED_LOCALES: { code: string; label: string }[] = [
  { code: "de", label: "German (Deutsch)" },
  { code: "fr", label: "French (Français)" },
  { code: "es", label: "Spanish (Español)" },
  { code: "it", label: "Italian (Italiano)" },
  { code: "nl", label: "Dutch (Nederlands)" },
  { code: "pt", label: "Portuguese (Português)" },
];

export const LOCALE_DICTIONARY: Record<string, LocaleStrings> = {
  de: {
    hd: "Wir schätzen Ihre Privatsphäre",
    bd: "Wir verwenden Cookies, um Ihr Einkaufserlebnis zu verbessern, personalisierte Inhalte anzuzeigen und unseren Datenverkehr zu analysieren. Sie können alle Cookies akzeptieren, nicht notwendige ablehnen oder Ihre Einstellungen anpassen.",
    ac: "Alle akzeptieren",
    rj: "Alle ablehnen",
    cu: "Anpassen",
    ph: "Datenschutz-Einstellungen",
    sv: "Einstellungen speichern",
    nn: "Notwendig",
    nd: "Erforderlich für den Betrieb des Shops. Immer aktiv.",
    pn: "Präferenzen",
    pd: "Speichert Ihre Einstellungen, z. B. Sprache oder Region.",
    an: "Analyse",
    ad: "Hilft uns zu verstehen, wie der Shop genutzt wird.",
    mn: "Marketing",
    md: "Wird verwendet, um Werbung zu personalisieren und zu messen.",
    oh: "Ihre Datenschutzoptionen",
    ob: "Wir geben möglicherweise Informationen über Ihre Nutzung unserer Website für Werbezwecke weiter. Sie können dem Verkauf oder der Weitergabe Ihrer persönlichen Daten widersprechen.",
    oo: "Meine Daten nicht verkaufen oder weitergeben",
    dm: "Schließen",
    rp: "Datenschutz",
    pp: "Datenschutzerklärung",
  },
  fr: {
    hd: "Nous respectons votre vie privée",
    bd: "Nous utilisons des cookies pour améliorer votre expérience, proposer du contenu personnalisé et analyser notre trafic. Vous pouvez tout accepter, refuser les cookies non essentiels ou personnaliser vos préférences.",
    ac: "Tout accepter",
    rj: "Tout refuser",
    cu: "Personnaliser",
    ph: "Préférences de confidentialité",
    sv: "Enregistrer les préférences",
    nn: "Nécessaires",
    nd: "Indispensables au fonctionnement de la boutique. Toujours actifs.",
    pn: "Préférences",
    pd: "Mémorise vos réglages, comme la langue ou la région.",
    an: "Analyse",
    ad: "Nous aide à comprendre comment la boutique est utilisée.",
    mn: "Marketing",
    md: "Sert à personnaliser et mesurer la publicité.",
    oh: "Vos choix de confidentialité",
    ob: "Nous pouvons partager des informations sur votre utilisation de notre site à des fins publicitaires. Vous pouvez refuser la vente ou le partage de vos informations personnelles.",
    oo: "Ne pas vendre ni partager mes informations personnelles",
    dm: "Fermer",
    rp: "Confidentialité",
    pp: "Politique de confidentialité",
  },
  es: {
    hd: "Valoramos su privacidad",
    bd: "Usamos cookies para mejorar su experiencia de navegación, mostrar contenido personalizado y analizar nuestro tráfico. Puede aceptar todas las cookies, rechazar las no esenciales o personalizar sus preferencias.",
    ac: "Aceptar todo",
    rj: "Rechazar todo",
    cu: "Personalizar",
    ph: "Preferencias de privacidad",
    sv: "Guardar preferencias",
    nn: "Necesarias",
    nd: "Imprescindibles para el funcionamiento de la tienda. Siempre activas.",
    pn: "Preferencias",
    pd: "Recuerda sus ajustes, como el idioma o la región.",
    an: "Analítica",
    ad: "Nos ayuda a entender cómo se usa la tienda.",
    mn: "Marketing",
    md: "Se usa para personalizar y medir la publicidad.",
    oh: "Sus opciones de privacidad",
    ob: "Podemos compartir información sobre su uso de nuestro sitio con fines publicitarios. Puede oponerse a la venta o el intercambio de su información personal.",
    oo: "No vender ni compartir mi información personal",
    dm: "Cerrar",
    rp: "Privacidad",
    pp: "Política de privacidad",
  },
  it: {
    hd: "Teniamo alla tua privacy",
    bd: "Utilizziamo i cookie per migliorare la tua esperienza di navigazione, offrire contenuti personalizzati e analizzare il nostro traffico. Puoi accettare tutti i cookie, rifiutare quelli non essenziali o personalizzare le tue preferenze.",
    ac: "Accetta tutto",
    rj: "Rifiuta tutto",
    cu: "Personalizza",
    ph: "Preferenze sulla privacy",
    sv: "Salva preferenze",
    nn: "Necessari",
    nd: "Indispensabili per il funzionamento del negozio. Sempre attivi.",
    pn: "Preferenze",
    pd: "Ricorda le tue impostazioni, come lingua o area geografica.",
    an: "Analisi",
    ad: "Ci aiuta a capire come viene usato il negozio.",
    mn: "Marketing",
    md: "Serve a personalizzare e misurare la pubblicità.",
    oh: "Le tue scelte sulla privacy",
    ob: "Potremmo condividere informazioni sull'uso del nostro sito a fini pubblicitari. Puoi opporti alla vendita o alla condivisione delle tue informazioni personali.",
    oo: "Non vendere né condividere le mie informazioni personali",
    dm: "Chiudi",
    rp: "Privacy",
    pp: "Informativa sulla privacy",
  },
  nl: {
    hd: "Wij waarderen uw privacy",
    bd: "We gebruiken cookies om uw winkelervaring te verbeteren, gepersonaliseerde content te tonen en ons verkeer te analyseren. U kunt alle cookies accepteren, niet-essentiële weigeren of uw voorkeuren aanpassen.",
    ac: "Alles accepteren",
    rj: "Alles weigeren",
    cu: "Aanpassen",
    ph: "Privacyvoorkeuren",
    sv: "Voorkeuren opslaan",
    nn: "Noodzakelijk",
    nd: "Vereist om de winkel te laten werken. Altijd actief.",
    pn: "Voorkeuren",
    pd: "Onthoudt uw instellingen, zoals taal of regio.",
    an: "Analyse",
    ad: "Helpt ons te begrijpen hoe de winkel wordt gebruikt.",
    mn: "Marketing",
    md: "Wordt gebruikt om advertenties te personaliseren en te meten.",
    oh: "Uw privacykeuzes",
    ob: "We kunnen informatie over uw gebruik van onze site delen voor advertentiedoeleinden. U kunt bezwaar maken tegen de verkoop of het delen van uw persoonsgegevens.",
    oo: "Mijn persoonsgegevens niet verkopen of delen",
    dm: "Sluiten",
    rp: "Privacy",
    pp: "Privacybeleid",
  },
  pt: {
    hd: "Valorizamos a sua privacidade",
    bd: "Usamos cookies para melhorar a sua experiência de navegação, apresentar conteúdo personalizado e analisar o nosso tráfego. Pode aceitar todos os cookies, recusar os não essenciais ou personalizar as suas preferências.",
    ac: "Aceitar tudo",
    rj: "Recusar tudo",
    cu: "Personalizar",
    ph: "Preferências de privacidade",
    sv: "Guardar preferências",
    nn: "Necessários",
    nd: "Essenciais para o funcionamento da loja. Sempre ativos.",
    pn: "Preferências",
    pd: "Guarda as suas definições, como idioma ou região.",
    an: "Análise",
    ad: "Ajuda-nos a perceber como a loja é utilizada.",
    mn: "Marketing",
    md: "Usado para personalizar e medir a publicidade.",
    oh: "As suas opções de privacidade",
    ob: "Podemos partilhar informações sobre a sua utilização do nosso site para fins publicitários. Pode opor-se à venda ou partilha das suas informações pessoais.",
    oo: "Não vender nem partilhar as minhas informações pessoais",
    dm: "Fechar",
    rp: "Privacidade",
    pp: "Política de privacidade",
  },
};

export function isSupportedLocale(code: string): boolean {
  return SUPPORTED_LOCALES.some((locale) => locale.code === code);
}

export async function listTranslations(shop: string): Promise<BannerTranslation[]> {
  return prisma.bannerTranslation.findMany({
    where: { shop },
    orderBy: { locale: "asc" },
  });
}

/** Adds a language with the dictionary's translated defaults (idempotent). */
export async function addTranslation(
  shop: string,
  locale: string,
): Promise<BannerTranslation> {
  const dictionary = LOCALE_DICTIONARY[locale];
  if (!dictionary) throw new Response(`Unsupported locale "${locale}"`, { status: 400 });
  return prisma.bannerTranslation.upsert({
    where: { shop_locale: { shop, locale } },
    update: {},
    create: {
      shop,
      locale,
      heading: dictionary.hd,
      body: dictionary.bd,
      acceptLabel: dictionary.ac,
      rejectLabel: dictionary.rj,
      customizeLabel: dictionary.cu,
    },
  });
}

export interface TranslationInput {
  heading: string;
  body: string;
  acceptLabel: string;
  rejectLabel: string;
  customizeLabel: string;
}

export async function updateTranslation(
  shop: string,
  locale: string,
  input: TranslationInput,
): Promise<BannerTranslation> {
  return prisma.bannerTranslation.update({
    where: { shop_locale: { shop, locale } },
    data: input,
  });
}

export async function deleteTranslation(shop: string, locale: string): Promise<void> {
  await prisma.bannerTranslation.deleteMany({ where: { shop, locale } });
}

/**
 * Builds the storefront i18n map: fixed strings from the dictionary overlaid
 * with the merchant's content fields, one entry per configured language.
 */
export async function buildI18n(
  shop: string,
): Promise<Record<string, LocaleStrings>> {
  const rows = await listTranslations(shop);
  const i18n: Record<string, LocaleStrings> = {};
  for (const row of rows) {
    const dictionary = LOCALE_DICTIONARY[row.locale];
    if (!dictionary) continue;
    i18n[row.locale] = {
      ...dictionary,
      hd: row.heading,
      bd: row.body,
      ac: row.acceptLabel,
      rj: row.rejectLabel,
      cu: row.customizeLabel,
    };
  }
  return i18n;
}
