import { publicGetOnce } from "@food/api";

const getCurrentAppType = () => {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  if (path.includes("/restaurant")) return "restaurant_app";
  if (path.includes("/delivery")) return "delivery_app";
  if (path.includes("/admin")) return "admin_app";
  return "user_app";
};

const applyConfigForApp = (appType, activeConfig, root) => {
  if (!activeConfig) return;

  if (appType === "user_app") {
    if (activeConfig.primaryColor) {
      root.style.setProperty("--primary", activeConfig.primaryColor);
      root.style.setProperty("--color-primary", activeConfig.primaryColor);
      root.style.setProperty("--color-primary-orange", activeConfig.primaryColor);
    }
    if (activeConfig.secondaryColor) {
      root.style.setProperty("--secondary", activeConfig.secondaryColor);
      root.style.setProperty("--color-secondary", activeConfig.secondaryColor);
    }
    if (activeConfig.logoUrl) {
      localStorage.setItem("user_app_logo", activeConfig.logoUrl);
    }
  } else if (appType === "restaurant_app") {
    if (activeConfig.primaryColor) {
      root.style.setProperty("--rt-primary", activeConfig.primaryColor);
    }
    if (activeConfig.secondaryColor) {
      root.style.setProperty("--rt-primary-strong", activeConfig.secondaryColor);
    }
    if (activeConfig.logoUrl) {
      localStorage.setItem("restaurant_app_logo", activeConfig.logoUrl);
    }
  } else if (appType === "delivery_app") {
    if (activeConfig.primaryColor) {
      root.style.setProperty("--dv-primary", activeConfig.primaryColor);
    }
    if (activeConfig.secondaryColor) {
      root.style.setProperty("--dv-primary-strong", activeConfig.secondaryColor);
    }
    if (activeConfig.logoUrl) {
      localStorage.setItem("delivery_app_logo", activeConfig.logoUrl);
    }
  } else if (appType === "admin_app") {
    if (activeConfig.primaryColor) {
      root.style.setProperty("--ad-primary", activeConfig.primaryColor);
    }
    if (activeConfig.secondaryColor) {
      root.style.setProperty("--ad-primary-strong", activeConfig.secondaryColor);
    }
    if (activeConfig.logoUrl) {
      localStorage.setItem("admin_app_logo", activeConfig.logoUrl);
    }
  }

  if (activeConfig.fontFamily) {
    root.style.setProperty("--main-font-family", activeConfig.fontFamily);
  }
};

export const applyDynamicTheme = async () => {
  try {
    const appType = getCurrentAppType();
    const response = await publicGetOnce(`/app-config/${appType}`, { noCache: true }).catch(() => null);
    const activeConfig = response?.data?.data || response?.data;

    applyConfigForApp(appType, activeConfig, document.documentElement);
    window.dispatchEvent(new CustomEvent("themeLoaded", { detail: { updated: true } }));
  } catch (error) {
    console.warn("Failed to load dynamic theme, falling back to default", error);
  }
};