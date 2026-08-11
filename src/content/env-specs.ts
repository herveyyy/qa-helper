export type EnvSpec = { label: string; value: string };

export function collectEnvSpecs(): EnvSpec[] {
  const nav = navigator as Navigator & {
    userAgentData?: { brands?: { brand: string; version: string }[]; platform?: string; mobile?: boolean };
    deviceMemory?: number;
  };

  const brands =
    nav.userAgentData?.brands
      ?.map((b) => `${b.brand} ${b.version}`)
      .join(", ") || "—";

  return [
    { label: "Browser", value: brands },
    { label: "User agent", value: navigator.userAgent },
    { label: "Platform", value: nav.userAgentData?.platform || navigator.platform || "—" },
    { label: "Language", value: navigator.language },
    { label: "Languages", value: navigator.languages?.join(", ") || "—" },
    { label: "Timezone", value: Intl.DateTimeFormat().resolvedOptions().timeZone },
    {
      label: "Screen",
      value: `${screen.width}×${screen.height} @ ${window.devicePixelRatio}x`,
    },
    {
      label: "Viewport",
      value: `${window.innerWidth}×${window.innerHeight}`,
    },
    {
      label: "CPU cores",
      value: String(navigator.hardwareConcurrency ?? "—"),
    },
    {
      label: "Device memory",
      value: nav.deviceMemory != null ? `${nav.deviceMemory} GB` : "—",
    },
    {
      label: "Touch points",
      value: String(navigator.maxTouchPoints ?? 0),
    },
    {
      label: "Online",
      value: navigator.onLine ? "Yes" : "No",
    },
    {
      label: "Cookies",
      value: navigator.cookieEnabled ? "Enabled" : "Disabled",
    },
    {
      label: "Page",
      value: location.href,
    },
    {
      label: "Extension",
      value: chrome.runtime.getManifest().version,
    },
  ];
}
