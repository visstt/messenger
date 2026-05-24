/** Формат: +7 (999) 999-99-99 */
export const RU_PHONE_PLACEHOLDER = "+7 (999) 999-99-99";

export function formatRuPhoneInput(raw) {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("8")) {
    digits = `7${digits.slice(1)}`;
  } else if (!digits.startsWith("7")) {
    digits = `7${digits}`;
  }

  digits = digits.slice(0, 11);
  const national = digits.slice(1);

  let result = "+7";
  if (!national) return result;

  result += ` (${national.slice(0, 3)}`;
  if (national.length <= 3) return result;

  result += `) ${national.slice(3, 6)}`;
  if (national.length <= 6) return result;

  result += `-${national.slice(6, 8)}`;
  if (national.length <= 8) return result;

  result += `-${national.slice(8, 10)}`;
  return result;
}
