export type DeviceFormFactor = 'phone' | 'tablet' | 'desktop';

export type DeviceContext = {
  form_factor: DeviceFormFactor;
  os: string;
  browser: string;
  platform: string;
  touch: boolean;
  screen: { w: number; h: number; dpr: number };
  viewport: { w: number; h: number };
  app_version: string;
};

type UserAgentData = {
  brands?: Array<{ brand: string; version: string }>;
  platform?: string;
  mobile?: boolean;
};

const getUserAgentData = (): UserAgentData | undefined => {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
};

const detectBrowser = (ua: string, brands?: Array<{ brand: string }>) => {
  const brand = brands?.find((item) => item.brand && item.brand !== 'Not.A/Brand')?.brand;
  if (brand) return brand;
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/OPR\//i.test(ua)) return 'Opera';
  if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
  if (/Chrome\//i.test(ua)) return 'Chrome';
  if (/Safari\//i.test(ua)) return 'Safari';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  return 'Unknown';
};

const detectOs = (ua: string, platform: string) => {
  const normalizedUa = ua.toLowerCase();
  if (normalizedUa.includes('android')) return 'Android';
  if (normalizedUa.includes('iphone') || normalizedUa.includes('ipad') || normalizedUa.includes('ipod')) return 'iOS';
  if (normalizedUa.includes('windows')) return 'Windows';
  if (normalizedUa.includes('mac os') || normalizedUa.includes('macintosh')) return 'macOS';
  if (normalizedUa.includes('linux')) return 'Linux';
  if (platform) return platform;
  return 'Unknown';
};

export const getDeviceContext = (): DeviceContext => {
  const win = typeof window !== 'undefined' ? window : undefined;
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const ua = nav?.userAgent ?? '';
  const uaData = getUserAgentData();
  const platform = uaData?.platform ?? nav?.platform ?? 'unknown';
  const touch = Boolean(win && ('ontouchstart' in win || (nav?.maxTouchPoints ?? 0) > 0));
  const viewport = {
    w: win?.innerWidth ?? 0,
    h: win?.innerHeight ?? 0
  };
  const screen = {
    w: win?.screen?.width ?? viewport.w,
    h: win?.screen?.height ?? viewport.h,
    dpr: win?.devicePixelRatio ?? 1
  };
  const form_factor: DeviceFormFactor = viewport.w < 768
    ? 'phone'
    : viewport.w < 1024 && touch
      ? 'tablet'
      : 'desktop';
  const app_version = import.meta.env.VITE_APP_VERSION ?? 'unknown';

  return {
    form_factor,
    os: detectOs(ua, platform),
    browser: detectBrowser(ua, uaData?.brands),
    platform,
    touch,
    screen,
    viewport,
    app_version
  };
};
