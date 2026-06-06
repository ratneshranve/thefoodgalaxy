import { useState, useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { adminAPI } from "@food/api"
import { ArrowLeft, Loader2, DollarSign } from "lucide-react"
import { toast } from "sonner"

export default function AdminEarningReport() {
  const location = useLocation()
  const navigate = useNavigate()
  
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  const filters = location.state?.filters || { time: "All Time", zone: "All Zones", restaurant: "All restaurants" }
  const searchQuery = location.state?.searchQuery || ""

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true)
        
        let fromDate = null
        let toDate = null
        const now = new Date()
        
        if (filters.time === "Today") {
          fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
        } else if (filters.time === "This Week") {
          const dayOfWeek = now.getDay()
          const diff = now.getDate() - dayOfWeek
          fromDate = new Date(now.getFullYear(), now.getMonth(), diff)
          toDate = new Date(now.getFullYear(), now.getMonth(), diff + 6, 23, 59, 59)
        } else if (filters.time === "This Month") {
          fromDate = new Date(now.getFullYear(), now.getMonth(), 1)
          toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
        }

        const params = {
          search: searchQuery || undefined,
          zone: filters.zone !== "All Zones" ? filters.zone : undefined,
          restaurant: filters.restaurant !== "All restaurants" ? filters.restaurant : undefined,
          fromDate: fromDate ? fromDate.toISOString() : undefined,
          toDate: toDate ? toDate.toISOString() : undefined,
          limit: 1000
        }

        const response = await adminAPI.getTransactionReport(params)

        if (response?.data?.success && response.data.data) {
          // Filter to only successful transactions (delivered, captured, settled) to show earnings
          const validTx = response.data.data.transactions.filter(t => 
            ['delivered', 'captured', 'settled'].includes(String(t.status).toLowerCase())
          )
          setTransactions(validTx || [])
        } else {
          setTransactions([])
          if (response?.data?.message) {
            toast.error(response.data.message)
          }
        }
      } catch (error) {
        console.error("Error fetching earning report:", error)
        toast.error("Failed to fetch earning report")
      } finally {
        setLoading(false)
      }
    }

    fetchReport()
  }, [])

  const formatMoney = (amount) => {
    return `\u20B9${Number(amount || 0).toFixed(2)}`
  }

  if (loading) {
    return (
      <div className="p-2 lg:p-3 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-gray-600">Loading admin earning details...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-green-600" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">Admin Earning Breakdown</h1>
            </div>
          </div>
          <div className="text-sm font-medium text-slate-500">
            {transactions.length} Transactions Found
          </div>
        </div>

        {/* Content Grid */}
        {transactions.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <DollarSign className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">No Earnings Found</h3>
            <p className="text-slate-500">No successful transactions matched the selected filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {transactions.map((tx) => {
              const breakdown = tx.adminEarningBreakdown || {}
              const totalAdmin = 
                (breakdown.deliveryProfit || 0) + 
                (breakdown.platformFee || 0) + 
                (breakdown.restaurantCommission || 0) + 
                (breakdown.packagingFee || 0) + 
                (breakdown.paymentGatewayFee || 0) + 
                (breakdown.tcs || 0)
                // Note: deliveryCostToAdmin etc are part of delivery profit calculation

              return (
                <div key={tx.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <div>
                      <h3 className="text-[15px] font-bold text-slate-900 tracking-wide">Order #{tx.orderId}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{tx.restaurant}</p>
                    </div>
                    <span className="px-2.5 py-1 bg-green-100 text-green-700 text-[10px] font-bold uppercase rounded-full tracking-wide">
                      {tx.status}
                    </span>
                  </div>

                  <div className="px-5 py-4 space-y-3">
                    {/* Items based on the screenshot */}
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-gray-600 font-medium">Delivery cost to admin</span>
                      <span className="text-[13px] text-gray-900">{formatMoney(breakdown.deliveryCostToAdmin)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-gray-600 font-medium">Delivery GST to admin (18%)</span>
                      <span className="text-[13px] text-gray-900">{formatMoney(breakdown.deliveryGstToAdmin)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-gray-600 font-medium">Platform fee to admin</span>
                      <span className="text-[13px] text-gray-900">{formatMoney(breakdown.platformFee)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-gray-600 font-medium">Restaurant commission</span>
                      <span className="text-[13px] text-gray-900">{formatMoney(breakdown.restaurantCommission)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-gray-600 font-medium">GST on commission</span>
                      <span className="text-[13px] text-gray-900">{formatMoney(breakdown.gstOnCommission)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-gray-600 font-medium">Payment gateway fee</span>
                      <span className="text-[13px] text-gray-900">{formatMoney(breakdown.paymentGatewayFee)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-gray-600 font-medium">TCS</span>
                      <span className="text-[13px] text-gray-900">{formatMoney(breakdown.tcs)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-gray-600 font-medium">GST collected from user</span>
                      <span className="text-[13px] text-gray-900">{formatMoney(breakdown.gstCollectedFromUser)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-gray-600 font-medium">Recommended item charge</span>
                      <span className="text-[13px] text-gray-900">{formatMoney(breakdown.packagingFee)}</span>
                    </div>

                    <div className="pt-3 mt-3 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-900">Total going to admin</span>
                      <span className="text-sm font-bold text-gray-900">
                        {formatMoney(breakdown.totalAdminReceivable || totalAdmin)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
