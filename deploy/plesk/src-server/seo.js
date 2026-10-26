// The public origin was confirmed by the site owner. Never use the preview host.
export const siteOrigin = 'https://bizconnectpay.com';

export const publicPages = {
  accueil: {
    path: '/',
    fr: ['Paiements en ligne en Afrique | BizConnectPay', 'Découvrez BizConnectPay : encaissement en ligne, Mobile Money, liens de paiement et cartes virtuelles pour les entrepreneurs et entreprises en Afrique.'],
    en: ['Online payments in Africa | BizConnectPay', 'Discover BizConnectPay: online payments, Mobile Money, payment links and virtual cards for entrepreneurs and businesses across Africa.'],
  },
  tarifs: {
    path: '/tarifs',
    fr: ['Tarifs : dépôts, retraits et cartes Visa | BizConnectPay', 'Consultez les tarifs BizConnectPay : dépôts PAYIN à 5 %, retraits PAYOUT à 3,5 %, première carte Visa à 2 000 FCFA et cartes supplémentaires à 1 800 FCFA.'],
    en: ['Pricing: deposits, withdrawals and Visa | BizConnectPay', 'View BizConnectPay pricing: 5% PAYIN deposit fees, 3.5% PAYOUT withdrawal fees, first Visa card at FCFA 2,000 and additional cards at FCFA 1,800.'],
  },
  contact: {
    path: '/contact',
    fr: ['Contact et accompagnement | BizConnectPay', 'Contactez l’équipe BizConnectPay pour vos questions sur les paiements en ligne, les dépôts, les retraits et les cartes Visa pour votre activité.'],
    en: ['Contact and support | BizConnectPay', 'Contact the BizConnectPay team for questions about online payments, deposits, withdrawals and Visa cards for your business.'],
  },
  apropos: {
    path: '/apropos',
    fr: ['À propos de notre plateforme | BizConnectPay', 'Découvrez BizConnectPay et notre plateforme technologique dédiée à la collecte de paiements et aux services financiers numériques en Afrique.'],
    en: ['About our platform | BizConnectPay', 'Learn about BizConnectPay and our technology platform for payment collection and digital financial services in Africa.'],
  },
  cgu: {
    path: '/cgu',
    fr: ['Conditions générales d’utilisation | BizConnectPay', 'Consultez les conditions générales d’utilisation de BizConnectPay : accès à la plateforme, utilisation des services et responsabilités des utilisateurs.'],
    en: ['Terms and conditions | BizConnectPay', 'Read the BizConnectPay terms and conditions covering platform access, use of services and user responsibilities.'],
  },
  confidentialite: {
    path: '/confidentialite',
    fr: ['Politique de confidentialité | BizConnectPay', 'Consultez la politique de confidentialité de BizConnectPay pour comprendre le traitement de vos données personnelles et connaître vos droits.'],
    en: ['Privacy policy | BizConnectPay', 'Read the BizConnectPay privacy policy to understand how your personal data is processed and learn about your rights.'],
  },
  mentions: {
    path: '/mentions',
    fr: ['Mentions légales du site | BizConnectPay', 'Retrouvez les mentions légales de BizConnectPay et les informations relatives à l’éditeur du site, à son hébergement et à la propriété intellectuelle.'],
    en: ['Legal notice | BizConnectPay', 'Read the BizConnectPay legal notice and information about the website publisher, hosting and intellectual property.'],
  },
  cookies: {
    path: '/cookies',
    fr: ['Politique relative aux cookies | BizConnectPay', 'Découvrez comment BizConnectPay utilise les cookies et consultez les informations relatives à leur fonctionnement et à leur gestion sur le site.'],
    en: ['Cookie policy | BizConnectPay', 'Learn how BizConnectPay uses cookies and read information about how they work and how to manage them on the website.'],
  },
};

export function publicPath(id, language = 'fr', basePath = '') {
  const page = publicPages[id];
  if (!page) throw new Error('Page publique inconnue.');
  return `${basePath}${language === 'en' ? '/en' : ''}${page.path === '/' && language === 'en' ? '' : page.path}`;
}

export function resolvePublicPage(pathname, basePath = '') {
  if (basePath && !pathname.startsWith(`${basePath}/`) && pathname !== basePath) return null;
  const relative = pathname.slice(basePath.length).replace(/\/+$/, '') || '/';
  for (const id of Object.keys(publicPages)) {
    for (const language of ['fr', 'en']) {
      if (relative === publicPath(id, language).replace(/\/+$/, '') || (relative === '/' && id === 'accueil' && language === 'fr')) {
        return { id, language };
      }
    }
  }
  return null;
}

export function pageMetadata(id, language, basePath = '') {
  const [title, description] = publicPages[id][language];
  const fr = siteOrigin + publicPath(id, 'fr', basePath);
  const en = siteOrigin + publicPath(id, 'en', basePath);
  return { title, description, canonical: language === 'en' ? en : fr, fr, en, image: `${siteOrigin}${basePath}/assets/logo.webp` };
}

export function sitemapXml(basePath = '') {
  const entries = Object.keys(publicPages).flatMap(id => ['fr', 'en'].map(language => {
    const seo = pageMetadata(id, language, basePath);
    return `<url><loc>${seo.canonical}</loc><xhtml:link rel="alternate" hreflang="fr" href="${seo.fr}"/><xhtml:link rel="alternate" hreflang="en" href="${seo.en}"/><xhtml:link rel="alternate" hreflang="x-default" href="${seo.fr}"/></url>`;
  }));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`;
}

export function robotsText(basePath = '', preview = false) {
  if (preview) return 'User-agent: *\nDisallow: /\n';
  return `User-agent: *\nAllow: ${basePath}/\nDisallow: ${basePath}/admin\nDisallow: ${basePath}/api/\nDisallow: ${basePath}/contact-request\nDisallow: ${basePath}/healthz\nSitemap: ${siteOrigin}${basePath}/sitemap.xml\n`;
}
