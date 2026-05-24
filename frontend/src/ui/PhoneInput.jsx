import clsx from "./utils/clsx.js";
import { formatRuPhoneInput, RU_PHONE_PLACEHOLDER } from "../utils/phoneMask";

export default function PhoneInput({
  value = "",
  onChange,
  onValueChange,
  className,
  ...props
}) {
  function handleChange(event) {
    const masked = formatRuPhoneInput(event.target.value);
    onValueChange?.(masked);
    onChange?.({
      ...event,
      target: { ...event.target, value: masked },
      currentTarget: { ...event.currentTarget, value: masked },
    });
  }

  return (
    <input
      {...props}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder={props.placeholder ?? RU_PHONE_PLACEHOLDER}
      className={clsx(!className && "tg-input", className)}
      value={value}
      onChange={handleChange}
    />
  );
}
