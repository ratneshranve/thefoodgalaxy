import { publicGetOnce } from "@food/api";

export const applyDynamicTheme = async () => {
  try {
    const apps = ['user_app', 'restaurant_app', 'delivery_app', 'admin_app'];
    
    const promises = apps.map(appType => 
      publicGetOnce(`/app-config/${appType}`, { noCache: true }).catch(() => null)
    );
    
    const results = await Promise.all(promises);
    const root = document.documentElement;
    
    const path = window.location.pathname;
    let currentAppType = 'user_app';
    if (path.includes('/restaurant')) currentAppType = 'restaurant_app';
    else if (path.includes('/delivery')) currentAppType = 'delivery_app';
    else if (path.includes('/admin')) currentAppType = 'admin_app';
    
    results.forEach((response, index) => {
      const activeConfig = response?.data?.data || response?.data;
      if (!activeConfig) return;
      
      const appType = apps[index];
      
      if (appType === 'user_app') {
        const primaryColor = activeConfig.primaryColor || '#DE0B09';
        const secondaryColor = activeConfig.secondaryColor || '#02350E';
        const accentColor = activeConfig.accentColor || '#F9A809';

        root.style.setProperty('--primary', primaryColor);
        root.style.setProperty('--color-primary', primaryColor);
        root.style.setProperty('--color-primary-orange', primaryColor);
        root.style.setProperty('--secondary', secondaryColor);
        root.style.setProperty('--color-secondary', secondaryColor);
        root.style.setProperty('--accent', accentColor);
        root.style.setProperty('--color-accent', accentColor);
        root.style.setProperty('--foreground', secondaryColor);
        root.style.setProperty('--card-foreground', secondaryColor);
        root.style.setProperty('--popover-foreground', secondaryColor);
        root.style.setProperty('--ring', primaryColor);
        root.style.setProperty('--sidebar-primary', primaryColor);
        root.style.setProperty('--sidebar-accent', accentColor);
        root.style.setProperty('--user-brand-primary', primaryColor);
        root.style.setProperty('--user-brand-secondary', secondaryColor);
        root.style.setProperty('--user-brand-accent', accentColor);
        root.style.setProperty('--user-brand-surface', '#FFF7E0');
        root.style.setProperty('--user-brand-soft', '#FFF1CC');
        root.style.setProperty('--user-brand-nav-active', '#FFF0C2');
        root.style.setProperty('--user-brand-card-shadow', 'rgba(222, 11, 9, 0.14)');

        if (activeConfig.logoUrl) {
          localStorage.setItem('user_app_logo', activeConfig.logoUrl);
        }
      } 
      else if (appType === 'restaurant_app') {
        if (activeConfig.primaryColor) {
          root.style.setProperty('--rt-primary', activeConfig.primaryColor);
        }
        if (activeConfig.secondaryColor) {
          root.style.setProperty('--rt-primary-strong', activeConfig.secondaryColor);
        }
        if (activeConfig.logoUrl) {
          localStorage.setItem('restaurant_app_logo', activeConfig.logoUrl);
        }
      }
      else if (appType === 'delivery_app') {
        if (activeConfig.primaryColor) {
          root.style.setProperty('--dv-primary', activeConfig.primaryColor);
        }
        if (activeConfig.secondaryColor) {
          root.style.setProperty('--dv-primary-strong', activeConfig.secondaryColor);
        }
        if (activeConfig.logoUrl) {
          localStorage.setItem('delivery_app_logo', activeConfig.logoUrl);
        }
      }
      else if (appType === 'admin_app') {
        if (activeConfig.primaryColor) {
          root.style.setProperty('--ad-primary', activeConfig.primaryColor);
        }
        if (activeConfig.secondaryColor) {
          root.style.setProperty('--ad-primary-strong', activeConfig.secondaryColor);
        }
        if (activeConfig.logoUrl) {
          localStorage.setItem('admin_app_logo', activeConfig.logoUrl);
        }
      }
      
      if (activeConfig.fontFamily && appType === currentAppType) {
        root.style.setProperty('--main-font-family', activeConfig.fontFamily);
      }
    });

    window.dispatchEvent(new CustomEvent('themeLoaded', { detail: { updated: true } }));

  } catch (error) {
    console.warn("Failed to load dynamic themes, falling back to default", error);
  }
};
