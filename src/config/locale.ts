// Localização central — Portugal (pt-PT).
export const locale = {
  language: "pt-PT",
  country: "PT",
  currency: "EUR",
  timezone: "Europe/Lisbon",
} as const;

export const labels = {
  taxId: "NIF",
  postalCode: "Código postal",
  address: "Morada",
  floor: "Andar/Fração",
  parish: "Freguesia",
  city: "Localidade",
  district: "Distrito",
  phone: "Telemóvel",
} as const;

export const DISTRITOS_PT = [
  "Aveiro", "Beja", "Braga", "Bragança", "Castelo Branco", "Coimbra", "Évora", "Faro",
  "Guarda", "Leiria", "Lisboa", "Portalegre", "Porto", "Santarém", "Setúbal",
  "Viana do Castelo", "Vila Real", "Viseu", "Região Autónoma dos Açores", "Região Autónoma da Madeira",
] as const;

type D = Date | string | number | null | undefined;
const toDate = (d: D) => (d == null || d === "" ? null : new Date(d));

export function formatMoney(cents: number) {
  return new Intl.NumberFormat(locale.language, { style: "currency", currency: locale.currency }).format((cents || 0) / 100);
}
export function formatDate(d: D) {
  const x = toDate(d);
  return x ? x.toLocaleDateString(locale.language, { timeZone: locale.timezone }) : "—";
}
export function formatDateTime(d: D) {
  const x = toDate(d);
  return x ? x.toLocaleString(locale.language, { timeZone: locale.timezone }) : "—";
}
export function formatTime(d: D) {
  const x = toDate(d);
  return x ? x.toLocaleTimeString(locale.language, { timeZone: locale.timezone, hour: "2-digit", minute: "2-digit" }) : "—";
}
