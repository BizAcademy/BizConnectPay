export const slots = [
  { key: 'hero_visual', label: 'Accueil — image à gauche de « Encaissez sans frontières »' },
  { key: 'simple_visual', label: 'Simple. Rapide. Sécurisé.' },
  { key: 'prod_in_visual', label: 'BizConnectPay-IN' },
  { key: 'prod_out_visual', label: 'BizConnectPay-OUT' },
  { key: 'prod_link_visual', label: 'BizConnectPay Link' },
  { key: 'prod_virtual_visual', label: 'BizConnectPay Virtual' },
];
export const settingKeys = [
  'signup_url', 'support_email', 'whatsapp', 'linkedin_url', 'facebook_url', 'x_url', 'api_docs_url',
  'legal_company', 'legal_form', 'legal_address', 'legal_registration', 'legal_director',
  'legal_host', 'legal_country', 'legal_city', 'legal_email', 'legal_phone',
];
export const slotKeys = new Set(slots.map(slot => slot.key));
export const imageMimes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
export const videoMimes = new Set(['video/mp4', 'video/webm']);
