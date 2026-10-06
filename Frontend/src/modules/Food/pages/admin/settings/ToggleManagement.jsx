import { useState, useEffect, useRef } from "react";
import { Info, Loader2, HardDrive, Server, Cloud, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { adminAPI } from "@food/api";
import { setCachedSettings } from "@food/utils/businessSettings";

const TOGGLE_LABELS = {
  onlinePaymentOnly: "Online payment only",
  maintenanceMode: "Maintenance mode",
  customerRegistration: "Customer registration",
  restaurantRegistration: "Restaurant registration",
  deliveryRegistration: "Delivery partner registration",
};

const UPLOAD_PROVIDER_OPTIONS = [
  {
    id: "local",
    label: "Local",
    icon: HardDrive,
    description: "Saves files on this server in the backend uploads folder. Best for development and small setups.",
    env: ["UPLOAD_LOCAL_DIR=uploads"],
  },
  {
    id: "vps",
    label: "VPS",
    icon: Server,
    description: "Saves files in a folder on your VPS (default /var/www/uploads). Can be served by nginx / a CDN.",
    env: ["UPLOAD_VPS_DIR=/var/www/uploads", "UPLOAD_VPS_PUBLIC_URL=https://yourdomain.com/uploads (optional)"],
  },
  {
    id: "cloudinary",
    label: "Cloudinary",
    icon: Cloud,
    description: "Uploads files to your Cloudinary account. Works on any hosting, no server disk needed.",
    env: ["CLOUDINARY_CLOUD_NAME=...", "CLOUDINARY_API_KEY=...", "CLOUDINARY_API_SECRET=..."],
  },
];

export default function ToggleManagement() {
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState(null);

  const [toggles, setToggles] = useState({
    onlinePaymentOnly: false,
    maxCodAmount: 0,
    uploadProvider: "local",
    maintenanceMode: false,
    customerRegistration: true,
    restaurantRegistration: true,
    deliveryRegistration: true,
  });

  const [storageStatus, setStorageStatus] = useState(null);

  const codSaveTimerRef = useRef(null);

  const fetchStorageStatus = async () => {
    try {
      const response = await adminAPI.getStorageStatus();
      setStorageStatus(response?.data?.data || response?.data || null);
    } catch {
      setStorageStatus(null);
    }
  };

  useEffect(() => {
    fetchBusinessSettings();
    fetchStorageStatus();
    return () => {
      if (codSaveTimerRef.current) clearTimeout(codSaveTimerRef.current);
    };
  }, []);

  const fetchBusinessSettings = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getBusinessSettings();
      const settings = response?.data?.data || response?.data;

      if (settings) {
        setToggles((prev) => ({
          ...prev,
          onlinePaymentOnly: settings.onlinePaymentOnly || false,
          maxCodAmount: settings.maxCodAmount || 0,
          uploadProvider: ["local", "vps", "cloudinary"].includes(settings.uploadProvider) ? settings.uploadProvider : "local",
          maintenanceMode: settings.maintenanceMode || false,
          customerRegistration: settings.customerRegistration !== false,
          restaurantRegistration: settings.restaurantRegistration !== false,
          deliveryRegistration: settings.deliveryRegistration !== false,
        }));
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load toggle settings");
    } finally {
      setLoading(false);
    }
  };

  const persistToggles = async (patch, fieldKey) => {
    setSavingField(fieldKey || null);
    try {
      const response = await adminAPI.updateBusinessToggles(patch);
      const updated = response?.data?.data || response?.data;
      if (updated) {
        setCachedSettings(updated);
        window.dispatchEvent(new CustomEvent("businessSettingsUpdated"));
      }
      if (fieldKey && TOGGLE_LABELS[fieldKey]) {
        toast.success(`${TOGGLE_LABELS[fieldKey]} updated`);
      } else if (fieldKey === "maxCodAmount") {
        toast.success("Max COD amount updated");
      }
    } catch (error) {
      await fetchBusinessSettings();
      toast.error(error?.response?.data?.message || "Failed to save toggle settings");
      throw error;
    } finally {
      setSavingField(null);
    }
  };

  const handleToggleChange = async (field) => {
    const nextValue = !toggles[field];
    setToggles((prev) => ({ ...prev, [field]: nextValue }));
    try {
      await persistToggles({ [field]: nextValue }, field);
    } catch {
      // state reverted in persistToggles via fetchBusinessSettings
    }
  };

  const handleUploadProviderChange = async (provider) => {
    if (toggles.uploadProvider === provider) return;
    const previous = toggles.uploadProvider;
    setToggles((prev) => ({ ...prev, uploadProvider: provider }));
    setSavingField("uploadProvider");
    try {
      const response = await adminAPI.updateBusinessToggles({ uploadProvider: provider });
      const updated = response?.data?.data || response?.data;
      if (updated) setCachedSettings(updated);
      const label = UPLOAD_PROVIDER_OPTIONS.find((o) => o.id === provider)?.label || provider;
      toast.success(`New uploads will be stored in: ${label}`);
    } catch (error) {
      setToggles((prev) => ({ ...prev, uploadProvider: previous }));
      toast.error(error?.response?.data?.message || "Failed to change upload storage");
    } finally {
      setSavingField(null);
      fetchStorageStatus();
    }
  };

  const handleInputChange = (field, value) => {
    setToggles((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (field !== "maxCodAmount") return;

    if (codSaveTimerRef.current) clearTimeout(codSaveTimerRef.current);
    codSaveTimerRef.current = setTimeout(async () => {
      try {
        await persistToggles({ maxCodAmount: Number(value) || 0 }, "maxCodAmount");
      } catch {
        // handled in persistToggles
      }
    }, 600);
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const isSaving = (field) => savingField === field;

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900">Toggle Management</h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            Enable or disable system modules and features dynamically.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3 max-w-md">
          <div className="mt-0.5">
            <Info className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xs lg:text-sm text-slate-700">
            <p className="font-semibold text-amber-700 mb-0.5">Note</p>
            <p>Toggles save instantly when you switch them. Max COD amount saves automatically after you stop typing.</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Upload storage provider */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-slate-900">Upload Storage</h3>
              {isSaving("uploadProvider") && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Choose where newly uploaded images, banners and documents are stored. Files that are already uploaded stay where they are and keep working.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {UPLOAD_PROVIDER_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = toggles.uploadProvider === option.id;
                const info = storageStatus?.providers?.[option.id];
                const ready = info ? info.available : true;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={isSaving("uploadProvider") || (!ready && !active)}
                    onClick={() => handleUploadProviderChange(option.id)}
                    className={`text-left rounded-xl border-2 p-4 transition-all disabled:cursor-not-allowed ${
                      active ? "border-blue-600 bg-blue-50/60" : "border-slate-200 bg-white hover:border-slate-300"
                    } ${!ready && !active ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Icon className={`w-4 h-4 ${active ? "text-blue-600" : "text-slate-500"}`} />
                        {option.label}
                      </span>
                      {active && <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">In use</span>}
                    </div>
                    <p className="text-xs text-slate-600 mb-3">{option.description}</p>
                    <p className={`flex items-start gap-1.5 text-[11px] font-medium ${ready ? "text-emerald-700" : "text-amber-700"}`}>
                      {ready ? <CheckCircle2 className="w-3.5 h-3.5 mt-px shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" />}
                      <span>{info ? info.message : "Checking..."}</span>
                    </p>
                    {info?.path && <p className="mt-1 break-all text-[10px] text-slate-400">{info.path}</p>}
                    {!ready && (
                      <div className="mt-2 rounded-lg bg-slate-50 p-2 text-[10px] text-slate-500">
                        <p className="font-semibold text-slate-600 mb-1">Add to backend .env:</p>
                        {option.env.map((line) => (
                          <p key={line} className="font-mono break-all">{line}</p>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="px-4 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">System Features</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center justify-between border border-slate-100 p-4 rounded-xl bg-slate-50/50">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Online Payment Only</p>
                  <p className="text-xs text-slate-500 mt-0.5">Disable Cash on Delivery globally</p>
                </div>
                <button
                  type="button"
                  disabled={isSaving("onlinePaymentOnly")}
                  onClick={() => handleToggleChange("onlinePaymentOnly")}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-60 ${
                    toggles.onlinePaymentOnly ? "bg-blue-600" : "bg-slate-200"
                  }`}
                >
                  {isSaving("onlinePaymentOnly") ? (
                    <Loader2 className="absolute inset-0 m-auto h-3.5 w-3.5 animate-spin text-white" />
                  ) : (
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        toggles.onlinePaymentOnly ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  )}
                </button>
              </div>

              {!toggles.onlinePaymentOnly && (
                <div className="flex items-center justify-between border border-slate-100 p-4 rounded-xl bg-slate-50/50">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Max COD Amount</p>
                    <p className="text-xs text-slate-500 mt-0.5">Disable COD if order exceeds this amount (0 for no limit)</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={toggles.maxCodAmount}
                      onChange={(e) => handleInputChange("maxCodAmount", e.target.value)}
                      className="w-24 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {isSaving("maxCodAmount") && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between border border-slate-100 p-4 rounded-xl bg-slate-50/50">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Maintenance Mode</p>
                  <p className="text-xs text-slate-500 mt-0.5">Suspend all customer ordering temporarily</p>
                </div>
                <button
                  type="button"
                  disabled={isSaving("maintenanceMode")}
                  onClick={() => handleToggleChange("maintenanceMode")}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-60 ${
                    toggles.maintenanceMode ? "bg-blue-600" : "bg-slate-200"
                  }`}
                >
                  {isSaving("maintenanceMode") ? (
                    <Loader2 className="absolute inset-0 m-auto h-3.5 w-3.5 animate-spin text-white" />
                  ) : (
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        toggles.maintenanceMode ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between border border-slate-100 p-4 rounded-xl bg-slate-50/50">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Customer Registration</p>
                  <p className="text-xs text-slate-500 mt-0.5">Allow new customers to sign up</p>
                </div>
                <button
                  type="button"
                  disabled={isSaving("customerRegistration")}
                  onClick={() => handleToggleChange("customerRegistration")}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-60 ${
                    toggles.customerRegistration ? "bg-blue-600" : "bg-slate-200"
                  }`}
                >
                  {isSaving("customerRegistration") ? (
                    <Loader2 className="absolute inset-0 m-auto h-3.5 w-3.5 animate-spin text-white" />
                  ) : (
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        toggles.customerRegistration ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between border border-slate-100 p-4 rounded-xl bg-slate-50/50">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Restaurant Registration</p>
                  <p className="text-xs text-slate-500 mt-0.5">Allow new restaurants to join</p>
                </div>
                <button
                  type="button"
                  disabled={isSaving("restaurantRegistration")}
                  onClick={() => handleToggleChange("restaurantRegistration")}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-60 ${
                    toggles.restaurantRegistration ? "bg-blue-600" : "bg-slate-200"
                  }`}
                >
                  {isSaving("restaurantRegistration") ? (
                    <Loader2 className="absolute inset-0 m-auto h-3.5 w-3.5 animate-spin text-white" />
                  ) : (
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        toggles.restaurantRegistration ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between border border-slate-100 p-4 rounded-xl bg-slate-50/50">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Delivery Partner Registration</p>
                  <p className="text-xs text-slate-500 mt-0.5">Allow new delivery riders to join</p>
                </div>
                <button
                  type="button"
                  disabled={isSaving("deliveryRegistration")}
                  onClick={() => handleToggleChange("deliveryRegistration")}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-60 ${
                    toggles.deliveryRegistration ? "bg-blue-600" : "bg-slate-200"
                  }`}
                >
                  {isSaving("deliveryRegistration") ? (
                    <Loader2 className="absolute inset-0 m-auto h-3.5 w-3.5 animate-spin text-white" />
                  ) : (
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        toggles.deliveryRegistration ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
