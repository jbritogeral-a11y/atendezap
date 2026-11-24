// Máscaras para Portugal (pt-PT).
export function maskNif(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 9);
  return d.replace(/^(\d{3})(\d)/, "$1 $2").replace(/^(\d{3}) (\d{3})(\d)/, "$1 $2 $3");
}
export function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 9);
  return d.replace(/^(\d{3})(\d)/, "$1 $2").replace(/^(\d{3}) (\d{3})(\d)/, "$1 $2 $3");
}
export function maskPostalCode(v: string) {
  return v.replace(/\D/g, "").slice(0, 7).replace(/^(\d{4})(\d)/, "$1-$2");
}
// Aliases de compatibilidade
export const maskCpf = maskNif;
export const maskCnpj = maskNif;
export const maskCep = maskPostalCode;
