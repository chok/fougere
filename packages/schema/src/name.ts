export function registrationKeyOf(className: string): string {
  return className ? className[0].toLowerCase() + className.slice(1) : className;
}

export function classNameOf(registrationKey: string): string {
  return registrationKey ? registrationKey[0].toUpperCase() + registrationKey.slice(1) : registrationKey;
}
