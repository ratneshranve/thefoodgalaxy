import React, { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, Eye, EyeOff } from "lucide-react";
import { adminAPI } from "../../../../../services/api/index.js";
import { toast } from "sonner";
import SubAdminForm from "./SubAdminForm";

export default function SubAdminsList() {
  const [subAdmins, setSubAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingSubAdmin, setEditingSubAdmin] = useState(null);
  const [showPasswords, setShowPasswords] = useState({});

  const togglePasswordVisibility = (id) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchSubAdmins = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getSubAdmins({ search: searchTerm });
      if (response.data.success) {
        setSubAdmins(response.data.data.subAdmins);
      } else {
        toast.error("Failed to fetch sub admins");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch sub admins");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubAdmins();
  }, [searchTerm]);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this sub admin?")) return;
    try {
      const response = await adminAPI.deleteSubAdmin(id);
      if (response.data.success) {
        toast.success("Sub admin deleted successfully");
        fetchSubAdmins();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete sub admin");
    }
  };

  const handleToggleStatus = async (admin) => {
    const newStatus = admin.isActive === false ? true : false;
    
    // Optimistic update
    setSubAdmins(prev => prev.map(a => 
      a._id === admin._id ? { ...a, isActive: newStatus } : a
    ));

    try {
      const response = await adminAPI.updateSubAdmin(admin._id, {
        isActive: newStatus,
      });
      if (response.data.success) {
        toast.success(`Sub admin ${newStatus ? 'activated' : 'deactivated'} successfully`);
      } else {
        // Revert on failure
        setSubAdmins(prev => prev.map(a => 
          a._id === admin._id ? { ...a, isActive: admin.isActive } : a
        ));
      }
    } catch (error) {
      // Revert on error
      setSubAdmins(prev => prev.map(a => 
        a._id === admin._id ? { ...a, isActive: admin.isActive } : a
      ));
      toast.error(error.response?.data?.message || "Failed to update status");
    }
  };

  const handleEdit = (subAdmin) => {
    setEditingSubAdmin(subAdmin);
    setShowForm(true);
  };

  const handleAddNew = () => {
    setEditingSubAdmin(null);
    setShowForm(true);
  };

  const handleFormClose = (shouldRefresh) => {
    setShowForm(false);
    setEditingSubAdmin(null);
    if (shouldRefresh) {
      fetchSubAdmins();
    }
  };

  if (showForm) {
    return <SubAdminForm subAdmin={editingSubAdmin} onClose={handleFormClose} />;
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Sub Admins</h1>
          <p className="text-sm text-gray-500">Manage sub admins and their permissions</p>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center gap-2 bg-[#11b5b8] text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus size={20} />
          <span>Add New</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by name or email..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11b5b8]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Name</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Email</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Password</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Phone</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : subAdmins.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    No sub admins found.
                  </td>
                </tr>
              ) : (
                subAdmins.map((admin) => (
                  <tr key={admin._id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-800">{admin.name}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{admin.email}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-gray-600">
                        <span className="font-mono text-sm tracking-wider">
                          {showPasswords[admin._id] ? (admin.visiblePassword || <span className="text-xs text-red-500 font-sans font-medium">Encrypted (Reset required)</span>) : "••••••••"}
                        </span>
                        <button
                          onClick={() => togglePasswordVisibility(admin._id)}
                          className="p-1 text-gray-400 hover:text-[#11b5b8] rounded-md transition-colors"
                          title={showPasswords[admin._id] ? "Hide password" : "Show password"}
                        >
                          {showPasswords[admin._id] ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{admin.phone || "N/A"}</td>
                    <td className="px-6 py-4">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={admin.isActive !== false}
                          onChange={() => handleToggleStatus(admin)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#11b5b8]"></div>
                      </label>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => handleEdit(admin)}
                          className="p-1.5 text-gray-400 hover:text-[#11b5b8] hover:bg-teal-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(admin._id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
