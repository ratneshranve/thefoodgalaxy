import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react"

const OrdersContext = createContext(null)

function normalizeOrderLookupId(value) {
  if (value == null) return ""
  return String(value).trim()
}

function orderLookupIds(order) {
  if (!order) return []
  return [
    order._id,
    order.mongoId,
    order.orderMongoId,
    order.orderId,
    order.id,
  ]
    .map(normalizeOrderLookupId)
    .filter(Boolean)
}

export function OrdersProvider({ children }) {
  const [orders, setOrders] = useState(() => {
    if (typeof window === "undefined") return []
    try {
      const saved = localStorage.getItem("userOrders")
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      // Only items that exist or are linked to an authenticated user
      const isAuthenticated = localStorage.getItem("user_authenticated") === "true" || !!localStorage.getItem("user_accessToken");
      if (orders.length > 0 || isAuthenticated) {
        localStorage.setItem("userOrders", JSON.stringify(orders))
      }
    } catch {
      // ignore storage errors
    }
  }, [orders])

  const createOrder = (orderData) => {
    const newOrder = {
      id: `ORD-${Date.now()}`,
      ...orderData,
      status: "confirmed",
      createdAt: new Date().toISOString(),
      tracking: {
        confirmed: { status: true, timestamp: new Date().toISOString() },
        preparing: { status: false, timestamp: null },
        outForDelivery: { status: false, timestamp: null },
        delivered: { status: false, timestamp: null }
      }
    }
    setOrders((prevOrders) => [newOrder, ...prevOrders])
    return newOrder.id
  }

  const upsertOrder = useCallback((apiOrder) => {
    if (!apiOrder || typeof apiOrder !== "object") return
    const incomingIds = orderLookupIds(apiOrder)
    if (incomingIds.length === 0) return

    setOrders((prevOrders) => {
      const idx = prevOrders.findIndex((existing) => {
        const existingIds = orderLookupIds(existing)
        return incomingIds.some((id) => existingIds.includes(id))
      })

      if (idx >= 0) {
        const next = [...prevOrders]
        next[idx] = { ...next[idx], ...apiOrder }
        return next
      }

      return [apiOrder, ...prevOrders]
    })
  }, [])

  useEffect(() => {
    const onOrderPlaced = (event) => {
      const placed = event?.detail?.order
      if (placed) upsertOrder(placed)
    }

    window.addEventListener("order-placed", onOrderPlaced)
    return () => window.removeEventListener("order-placed", onOrderPlaced)
  }, [upsertOrder])

  const getOrderById = useCallback((orderId) => {
    const needle = normalizeOrderLookupId(orderId)
    if (!needle) return null

    return orders.find((order) => orderLookupIds(order).includes(needle)) || null
  }, [orders])

  const getAllOrders = useCallback(() => {
    return [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [orders])

  const updateOrderStatus = useCallback((orderId, status) => {
    setOrders((prevOrders) => prevOrders.map(order => {
      if (order.id === orderId) {
        const updatedTracking = { ...order.tracking }
        if (status === "preparing") {
          updatedTracking.preparing = { status: true, timestamp: new Date().toISOString() }
        } else if (status === "outForDelivery") {
          updatedTracking.outForDelivery = { status: true, timestamp: new Date().toISOString() }
        } else if (status === "delivered") {
          updatedTracking.delivered = { status: true, timestamp: new Date().toISOString() }
        }
        return {
          ...order,
          status,
          tracking: updatedTracking
        }
      }
      return order
    }))
  }, [])

  const value = useMemo(() => ({
    orders,
    createOrder,
    getOrderById,
    getAllOrders,
    updateOrderStatus
  }), [orders])

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>
}

export function useOrders() {
  const context = useContext(OrdersContext)
  if (!context) {
    throw new Error("useOrders must be used within an OrdersProvider")
  }
  return context
}
