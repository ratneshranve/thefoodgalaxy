const fs = require('fs');
let content = fs.readFileSync('src/modules/Food/pages/restaurant/OutletInfo.jsx', 'utf8');

// 1. Add imports for Input, Dialog, Button
if (!content.includes('import { Input }')) {
  content = content.replace('import { ImageSourcePicker }', 'import { Input } from "@food/components/ui/input"\nimport { Button } from "@food/components/ui/button"\nimport {\n  Dialog,\n  DialogContent,\n  DialogHeader,\n  DialogTitle,\n  DialogFooter,\n} from "@food/components/ui/dialog"\nimport { ImageSourcePicker }');
}

// 2. Fix view image buttons
content = content.replace(/window\.open\(restaurantData\?\.fssaiImage, "_blank"\)/g, 'window.open(restaurantData?.fssaiImage?.url || restaurantData?.fssaiImage, "_blank")');
content = content.replace(/window\.open\(restaurantData\?\.panImage, "_blank"\)/g, 'window.open(restaurantData?.panImage?.url || restaurantData?.panImage, "_blank")');

// 3. Add states for edit modal
const stateRegex = /const \[activePicker, setActivePicker\] = useState\(null\)/;
const newStates = `const [activePicker, setActivePicker] = useState(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editSection, setEditSection] = useState(null)
  const [editFormData, setEditFormData] = useState({})
  const [savingEdit, setSavingEdit] = useState(false)`;
content = content.replace(stateRegex, newStates);

// 4. Add edit handlers
const handlerRegex = /const handleCoverImageDelete = async/;
const editHandlers = `const handleEditClick = (section) => {
    setEditSection(section)
    setEditFormData({...restaurantData})
    setEditModalOpen(true)
  }

  const handleEditSave = async () => {
    try {
      setSavingEdit(true)
      const payload = {}
      if (editSection === 'restaurantName') {
        payload.restaurantName = editFormData.restaurantName || editFormData.name
      } else if (editSection === 'basic') {
        payload.ownerName = editFormData.ownerName
        payload.primaryContactNumber = editFormData.primaryContactNumber
        payload.ownerEmail = editFormData.ownerEmail || editFormData.email
        payload.pureVegRestaurant = editFormData.pureVegRestaurant
      } else if (editSection === 'compliance') {
        payload.panNumber = editFormData.panNumber
        payload.gstNumber = editFormData.gstNumber
        payload.fssaiNumber = editFormData.fssaiNumber
        payload.fssaiExpiry = editFormData.fssaiExpiry
      } else if (editSection === 'bank') {
        payload.accountHolderName = editFormData.accountHolderName
        payload.accountNumber = editFormData.accountNumber
        payload.ifscCode = editFormData.ifscCode
        payload.upiId = editFormData.upiId
      }
      
      await restaurantAPI.updateProfile(payload)
      toast.success('Details updated successfully!')
      
      // refresh data
      const response = await restaurantAPI.getCurrentRestaurant()
      const data = response?.data?.data?.restaurant || response?.data?.restaurant
      if (data) {
        setRestaurantData(data)
        if (data.name || data.restaurantName) setRestaurantName(data.name || data.restaurantName)
      }
      
      setEditModalOpen(false)
      window.dispatchEvent(new Event('ownerDataUpdated'))
    } catch (error) {
      toast.error('Failed to update details.')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleCoverImageDelete = async`;
content = content.replace(handlerRegex, editHandlers);

// 5. Replace onClick={() => navigate("/food/restaurant/edit-owner")} with handleEditClick
content = content.replace(/<button onClick={\(\) => navigate\("\/food\/restaurant\/edit-owner"\)} className="text-\[#2563EB\] text-sm font-bold hover:underline">Edit<\/button>/g, function(match, offset, string) {
  // Let's determine the section by context
  const preText = string.substring(Math.max(0, offset - 200), offset);
  if (preText.includes('Restaurant name')) return '<button onClick={() => handleEditClick(\'restaurantName\')} className="text-[#2563EB] text-sm font-bold hover:underline">Edit</button>';
  if (preText.includes('Basic details')) return '<button onClick={() => handleEditClick(\'basic\')} className="text-[#2563EB] text-sm font-bold hover:underline">Edit</button>';
  if (preText.includes('Compliance details')) return '<button onClick={() => handleEditClick(\'compliance\')} className="text-[#2563EB] text-sm font-bold hover:underline">Edit</button>';
  if (preText.includes('Bank and UPI details')) return '<button onClick={() => handleEditClick(\'bank\')} className="text-[#2563EB] text-sm font-bold hover:underline">Edit</button>';
  return match;
});

// 6. Add modal JSX at the end before </ImageSourcePicker>
const modalJsx = `{/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="w-[90%] sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit {editSection === 'restaurantName' ? 'Restaurant Name' : editSection === 'basic' ? 'Basic Details' : editSection === 'compliance' ? 'Compliance Details' : 'Bank Details'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {editSection === 'restaurantName' && (
              <div>
                <label className="text-sm font-medium mb-1 block">Restaurant Name</label>
                <Input value={editFormData.restaurantName || editFormData.name || ''} onChange={e => setEditFormData({...editFormData, restaurantName: e.target.value})} />
              </div>
            )}
            {editSection === 'basic' && (
              <>
                <div>
                  <label className="text-sm font-medium mb-1 block">Owner Name</label>
                  <Input value={editFormData.ownerName || ''} onChange={e => setEditFormData({...editFormData, ownerName: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Primary Contact</label>
                  <Input value={editFormData.primaryContactNumber || editFormData.ownerPhone || ''} onChange={e => setEditFormData({...editFormData, primaryContactNumber: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Email</label>
                  <Input value={editFormData.email || editFormData.ownerEmail || ''} onChange={e => setEditFormData({...editFormData, email: e.target.value})} />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input type="checkbox" id="pureVeg" checked={!!editFormData.pureVegRestaurant} onChange={e => setEditFormData({...editFormData, pureVegRestaurant: e.target.checked})} className="w-4 h-4" />
                  <label htmlFor="pureVeg" className="text-sm font-medium">Pure Veg Restaurant</label>
                </div>
              </>
            )}
            {editSection === 'compliance' && (
              <>
                <div>
                  <label className="text-sm font-medium mb-1 block">PAN Number</label>
                  <Input value={editFormData.panNumber || ''} onChange={e => setEditFormData({...editFormData, panNumber: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">GST Number</label>
                  <Input value={editFormData.gstNumber || ''} onChange={e => setEditFormData({...editFormData, gstNumber: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">FSSAI Number</label>
                  <Input value={editFormData.fssaiNumber || ''} onChange={e => setEditFormData({...editFormData, fssaiNumber: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">FSSAI Expiry</label>
                  <Input type="date" value={editFormData.fssaiExpiry ? new Date(editFormData.fssaiExpiry).toISOString().split('T')[0] : ''} onChange={e => setEditFormData({...editFormData, fssaiExpiry: e.target.value})} />
                </div>
              </>
            )}
            {editSection === 'bank' && (
              <>
                <div>
                  <label className="text-sm font-medium mb-1 block">Account Holder</label>
                  <Input value={editFormData.accountHolderName || editFormData.nameOnPan || ''} onChange={e => setEditFormData({...editFormData, accountHolderName: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Account Number</label>
                  <Input value={editFormData.accountNumber || ''} onChange={e => setEditFormData({...editFormData, accountNumber: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">IFSC Code</label>
                  <Input value={editFormData.ifscCode || ''} onChange={e => setEditFormData({...editFormData, ifscCode: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">UPI ID</label>
                  <Input value={editFormData.upiId || ''} onChange={e => setEditFormData({...editFormData, upiId: e.target.value})} />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={savingEdit}>{savingEdit ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <ImageSourcePicker`;
content = content.replace('<ImageSourcePicker', modalJsx);

fs.writeFileSync('src/modules/Food/pages/restaurant/OutletInfo.jsx', content);
console.log('OutletInfo.jsx updated successfully.');
