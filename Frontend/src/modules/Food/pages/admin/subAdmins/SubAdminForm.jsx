import React, { useState, useEffect } from "react";
import { ArrowLeft, Save, Eye, EyeOff } from "lucide-react";
import { adminAPI } from "../../../../../services/api/index.js";
import { toast } from "sonner";
import { adminSidebarMenu } from "../../../utils/adminSidebarMenu.js";

export default function SubAdminForm({ subAdmin, onClose }) {
  const isEditing = !!subAdmin;
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    isActive: true,
  });

  const [accessibleModules, setAccessibleModules] = useState([]);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (subAdmin) {
      setFormData({
        name: subAdmin.name || "",
        email: subAdmin.email || "",
        phone: subAdmin.phone || "",
        password: "", // Empty for edit, only sent if changed
        isActive: subAdmin.isActive !== false,
      });
      setAccessibleModules(subAdmin.accessibleModules || []);
    }
  }, [subAdmin]);

  const extractMenuLabels = () => {
    const labels = [];
    adminSidebarMenu.forEach((item) => {
      if (item.type === "section") {
        labels.push({ type: "section", label: item.label });
        item.items?.forEach((subItem) => {
          if (subItem.type === "expandable") {
            // Include main parent
            labels.push({ type: "item", label: subItem.label });
            // Include sub items for granular permissions
            subItem.subItems?.forEach((deepSubItem) => {
              labels.push({ type: "sub-item", label: deepSubItem.label, parent: subItem.label });
            });
          } else {
            labels.push({ type: "item", label: subItem.label });
          }
        });
      } else {
        labels.push({ type: "item", label: item.label });
      }
    });
    return labels;
  };

  const menuItems = extractMenuLabels();

  const handleToggleModule = (label) => {
    setAccessibleModules((prev) =>
      prev.includes(label)
        ? prev.filter((m) => m !== label)
        : [...prev, label]
    );
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      return toast.error("Name and email are required");
    }
    if (!isEditing && !formData.password) {
      return toast.error("Password is required for new sub admin");
    }

    setLoading(true);
    const payload = {
      ...formData,
      accessibleModules,
    };

    if (isEditing && !payload.password) {
      delete payload.password;
    }

    try {
      if (isEditing) {
        const res = await adminAPI.updateSubAdmin(subAdmin._id, payload);
        if (res.data.success) {
          toast.success("Sub admin updated successfully");
          onClose(true);
        }
      } else {
        const res = await adminAPI.createSubAdmin(payload);
        if (res.data.success) {
          toast.success("Sub admin created successfully");
          onClose(true);
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => onClose(false)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {isEditing ? "Edit Sub Admin" : "Add Sub Admin"}
          </h1>
          <p className="text-sm text-gray-500">
            {isEditing
              ? "Modify details and permissions"
              : "Create a new sub admin and assign permissions"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Details */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
                Basic Details
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11b5b8]"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11b5b8]"
                  placeholder="john@example.com"
                  required
                  disabled={isEditing}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11b5b8]"
                  placeholder="+1 234 567 890"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password {isEditing && "(Leave empty to keep current)"} {!isEditing && "*"}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11b5b8] pr-10"
                    placeholder={isEditing ? "•••••••• (Encrypted)" : "Enter password"}
                    required={!isEditing}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-[#11b5b8]"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="isActive"
                    className="sr-only peer"
                    checked={formData.isActive}
                    onChange={handleChange}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#11b5b8]"></div>
                </label>
                <span className="text-sm font-medium text-gray-700">
                  Account Active
                </span>
              </div>
            </div>
          </div>

          {/* Right Column - Permissions */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between border-b pb-4 mb-4">
                <h2 className="text-lg font-semibold text-gray-800">
                  Module Permissions
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    const allLabels = menuItems.filter(i => i.type === 'item').map(i => i.label);
                    if (accessibleModules.length === allLabels.length) {
                      setAccessibleModules([]);
                    } else {
                      setAccessibleModules(allLabels);
                    }
                  }}
                  className="text-sm text-[#11b5b8] hover:text-teal-700 font-medium"
                >
                  {accessibleModules.length > 0 && accessibleModules.length === menuItems.filter(i => i.type === 'item').length 
                    ? "Deselect All" 
                    : "Select All"}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                {menuItems.map((item, index) => {
                  if (item.type === "section") {
                    return (
                      <div key={index} className="col-span-full mt-4 mb-2">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                          {item.label}
                        </h3>
                      </div>
                    );
                  }

                  const isChecked = accessibleModules.includes(item.label);
                  const isSubItem = item.type === "sub-item";

                  return (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors cursor-pointer ${
                        isSubItem ? "ml-8 border-l-2 border-l-gray-200 rounded-l-none" : ""
                      }`}
                      onClick={() => handleToggleModule(item.label)}
                    >
                      <span className={`${isSubItem ? "text-gray-600 text-sm" : "text-gray-700 font-medium"}`}>
                        {isSubItem && <span className="text-gray-300 mr-2">↳</span>}
                        {item.label}
                      </span>
                      <div className="relative inline-flex items-center">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={isChecked}
                          readOnly
                        />
                        <div className={`w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all ${isSubItem ? "peer-checked:bg-teal-500 scale-90" : "peer-checked:bg-[#11b5b8]"}`}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-4 border-t pt-6">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="px-6 py-2 border rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-[#11b5b8] text-white px-6 py-2 rounded-lg hover:bg-teal-700 font-medium transition-colors disabled:opacity-70"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save size={20} />
            )}
            <span>{isEditing ? "Save Changes" : "Create Sub Admin"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
