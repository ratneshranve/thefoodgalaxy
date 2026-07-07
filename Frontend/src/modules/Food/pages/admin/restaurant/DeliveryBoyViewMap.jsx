import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { MapPin, ArrowLeft, Search, Bike } from "lucide-react"
import { adminAPI } from "@food/api"
import { getGoogleMapsApiKey } from "@food/utils/googleMapsApiKey"
import { Loader } from "@googlemaps/js-api-loader"
import { subscribeAllDeliveryLocations } from "@food/realtimeTracking"

const API_REFRESH_MS = 30000

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function isValidCoord(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  )
}

function isFirebaseOnline(payload = {}) {
  return (
    payload?.isOnline === true ||
    payload?.status === "online" ||
    payload?.status === "busy"
  )
}

function readPartnerCoords(partner = {}) {
  let lat = Number(partner?.lastLat)
  let lng = Number(partner?.lastLng)

  const coords = partner?.lastLocation?.coordinates
  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && Array.isArray(coords) && coords.length >= 2) {
    lng = Number(coords[0])
    lat = Number(coords[1])
  }

  return { lat, lng }
}

function buildRiderInfoHtml(rider) {
  const lastUpdate = rider?.lastUpdate
    ? new Date(rider.lastUpdate).toLocaleTimeString()
    : null

  return `
    <div style="padding: 12px; min-width: 220px;">
      <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1e293b;">
        ${escapeHtml(rider?.name || "Delivery Partner")}
      </h3>
      <div style="font-size: 13px; color: #64748b; line-height: 1.6;">
        <div style="margin-bottom: 4px;">
          <strong>Phone:</strong> ${escapeHtml(rider?.phone || "N/A")}
        </div>
        <div style="margin-bottom: 4px;">
          <strong>Status:</strong>
          <span style="color: #10b981; font-weight: 600;">Online</span>
        </div>
        ${
          lastUpdate
            ? `<div style="margin-top: 8px; font-size: 12px; color: #94a3b8;">
                Last updated: ${lastUpdate}
              </div>`
            : ""
        }
      </div>
    </div>
  `
}

function createRiderOverlayClass(google) {
  return class DeliveryRiderOverlay extends google.maps.OverlayView {
    constructor({ position, rider, onSelect }) {
      super()
      this.position = position
      this.rider = rider
      this.onSelect = onSelect
      this.div = null
      this.nameEl = null
      this.dotEl = null
    }

    onAdd() {
      this.div = document.createElement("div")
      this.div.className = "delivery-rider-map-marker"
      this.div.style.cssText =
        "position:absolute;transform:translate(-50%,-100%);cursor:pointer;text-align:center;pointer-events:auto;z-index:1200;"

      this.dotEl = document.createElement("div")
      this.dotEl.style.cssText =
        "width:16px;height:16px;margin:0 auto;border-radius:50%;background:#22c55e;border:3px solid #fff;box-shadow:0 0 0 2px rgba(34,197,94,.35), 0 2px 6px rgba(0,0,0,.3);"

      this.nameEl = document.createElement("div")
      this.nameEl.style.cssText =
        "margin-top:4px;background:#1e293b;color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.25);border:1px solid #fff;max-width:140px;overflow:hidden;text-overflow:ellipsis;"

      this.div.appendChild(this.dotEl)
      this.div.appendChild(this.nameEl)
      this.div.addEventListener("click", (event) => {
        event.stopPropagation()
        this.onSelect?.(this.rider)
      })

      this.renderContent()
      this.getPanes()?.overlayMouseTarget?.appendChild(this.div)
    }

    renderContent() {
      if (!this.nameEl) return
      this.nameEl.textContent = this.rider?.name || "Rider"
    }

    draw() {
      if (!this.div) return
      const projection = this.getProjection()
      const point = projection?.fromLatLngToDivPixel(
        new google.maps.LatLng(this.position.lat, this.position.lng),
      )
      if (!point) return
      this.div.style.left = `${point.x}px`
      this.div.style.top = `${point.y}px`
    }

    onRemove() {
      this.div?.remove()
      this.div = null
      this.nameEl = null
      this.dotEl = null
    }

    update({ position, rider }) {
      this.position = position
      this.rider = rider
      this.renderContent()
      this.draw()
    }
  }
}

export default function DeliveryBoyViewMap() {
  const navigate = useNavigate()
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const zonesPolygonsRef = useRef([])
  const zoneInfoWindowsRef = useRef([])
  const markersMapRef = useRef(new Map())
  const ridersMapRef = useRef(new Map())
  const partnerMetaRef = useRef(new Map())
  const riderOverlayClassRef = useRef(null)
  const hasFitRiderBoundsRef = useRef(false)
  const selectedRiderIdRef = useRef(null)

  const [googleMapsApiKey, setGoogleMapsApiKey] = useState("")
  const [mapLoading, setMapLoading] = useState(true)
  const [zonesLoading, setZonesLoading] = useState(true)
  const [ridersLoading, setRidersLoading] = useState(true)
  const [zones, setZones] = useState([])
  const [onlineRiders, setOnlineRiders] = useState([])
  const [selectedRiderId, setSelectedRiderId] = useState(null)
  const [locationSearch, setLocationSearch] = useState("")
  const autocompleteInputRef = useRef(null)
  const autocompleteRef = useRef(null)
  const riderInfoWindowRef = useRef(null)

  const syncRidersToState = useCallback(() => {
    const riders = Array.from(ridersMapRef.current.values()).sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || "")),
    )
    setOnlineRiders(riders)
    setRidersLoading(false)
  }, [])

  const getPartnerMeta = useCallback((id) => {
    return partnerMetaRef.current.get(String(id)) || null
  }, [])

  const mergeRider = useCallback(
    (id, patch = {}) => {
      const riderId = String(id || "").trim()
      if (!riderId) return

      const meta = getPartnerMeta(riderId)
      const previous = ridersMapRef.current.get(riderId) || {
        _id: riderId,
        name: meta?.name || "Delivery Partner",
        phone: meta?.phone || "N/A",
      }

      const nextUpdate = Number(patch.lastUpdate || 0)
      const prevUpdate = Number(previous.lastUpdate || 0)
      if (nextUpdate > 0 && prevUpdate > 0 && nextUpdate < prevUpdate) {
        return
      }

      ridersMapRef.current.set(riderId, {
        ...previous,
        ...patch,
        _id: riderId,
        name: patch.name || meta?.name || previous.name || "Delivery Partner",
        phone: patch.phone || meta?.phone || previous.phone || "N/A",
        lastUpdate: Math.max(prevUpdate, nextUpdate),
      })
    },
    [getPartnerMeta],
  )

  const removeRider = useCallback((id, sourceOnly = null) => {
    const riderId = String(id || "").trim()
    if (!riderId) return
    const existing = ridersMapRef.current.get(riderId)
    if (!existing) return
    if (sourceOnly && existing.source !== sourceOnly) return
    ridersMapRef.current.delete(riderId)
  }, [])

  const applyApiPartners = useCallback(
    (partners = []) => {
      const onlineIds = new Set()

      partners.forEach((partner) => {
        const id = String(partner?._id || partner?.id || "").trim()
        if (!id) return

        partnerMetaRef.current.set(id, {
          name: partner?.name || "Delivery Partner",
          phone: partner?.phone || "N/A",
          availabilityStatus: partner?.availabilityStatus || "offline",
        })

        if (partner?.availabilityStatus !== "online") {
          removeRider(id, "api")
          return
        }

        const { lat, lng } = readPartnerCoords(partner)
        if (!isValidCoord(lat, lng)) return

        const lastUpdate = partner?.lastLocationAt
          ? new Date(partner.lastLocationAt).getTime()
          : Date.now()

        onlineIds.add(id)
        mergeRider(id, {
          name: partner?.name || "Delivery Partner",
          phone: partner?.phone || "N/A",
          lat,
          lng,
          heading: Number(partner?.heading) || 0,
          lastUpdate,
          source: "api",
        })
      })

      ridersMapRef.current.forEach((rider, id) => {
        if (rider.source === "api" && !onlineIds.has(id)) {
          ridersMapRef.current.delete(id)
        }
      })

      syncRidersToState()
    },
    [mergeRider, removeRider, syncRidersToState],
  )

  const applyFirebaseLocations = useCallback(
    (deliveryNode = {}) => {
      Object.entries(deliveryNode || {}).forEach(([deliveryId, payload]) => {
        const id = String(deliveryId || "").trim()
        if (!id) return

        const meta = getPartnerMeta(id)

        if (!isFirebaseOnline(payload)) {
          removeRider(id, "firebase")
          return
        }

        const lat = Number(payload?.lat)
        const lng = Number(payload?.lng)
        if (!isValidCoord(lat, lng)) return

        mergeRider(id, {
          name: meta?.name || "Delivery Partner",
          phone: meta?.phone || "N/A",
          lat,
          lng,
          heading: Number(payload?.heading) || 0,
          lastUpdate: Number(payload?.timestamp || payload?.last_updated) || Date.now(),
          source: "firebase",
        })
      })

      syncRidersToState()
    },
    [getPartnerMeta, mergeRider, removeRider, syncRidersToState],
  )

  const fetchOnlineRidersFromApi = useCallback(async () => {
    try {
      const response = await adminAPI.getLiveMonitorStatus()
      const partners = response?.data?.data?.deliveryPartners || []
      applyApiPartners(partners)
    } catch (error) {
      console.error("Error fetching online delivery partners:", error)
      setRidersLoading(false)
    }
  }, [applyApiPartners])

  const fetchZones = useCallback(async () => {
    try {
      setZonesLoading(true)
      const response = await adminAPI.getZones({ limit: 1000 })
      if (response.data?.success && response.data.data?.zones) {
        setZones(response.data.data.zones)
      } else {
        setZones([])
      }
    } catch (error) {
      console.error("Error fetching zones:", error)
      setZones([])
    } finally {
      setZonesLoading(false)
    }
  }, [])

  const openRiderInfo = useCallback((google, map, rider) => {
    if (!rider || !map) return
    const id = String(rider._id)
    selectedRiderIdRef.current = id
    setSelectedRiderId(id)

    if (!riderInfoWindowRef.current) {
      riderInfoWindowRef.current = new google.maps.InfoWindow()
    }

    riderInfoWindowRef.current.setContent(buildRiderInfoHtml(rider))
    riderInfoWindowRef.current.setPosition({ lat: Number(rider.lat), lng: Number(rider.lng) })
    riderInfoWindowRef.current.open(map)
  }, [])

  const updateDeliveryMarkers = useCallback(
    async (google, map, riders) => {
      if (!riderOverlayClassRef.current) {
        riderOverlayClassRef.current = createRiderOverlayClass(google)
      }
      const RiderOverlay = riderOverlayClassRef.current
      const activeIds = new Set()

      for (const rider of riders) {
        const id = String(rider?._id || "")
        if (!id) continue

        const lat = Number(rider.lat)
        const lng = Number(rider.lng)
        if (!isValidCoord(lat, lng)) continue

        activeIds.add(id)
        const position = { lat, lng }

        let entry = markersMapRef.current.get(id)
        if (!entry) {
          const overlay = new RiderOverlay({
            position,
            rider,
            onSelect: (selected) => openRiderInfo(google, map, selected),
          })
          overlay.setMap(map)
          entry = { overlay }
          markersMapRef.current.set(id, entry)
        } else {
          entry.overlay.update({ position, rider })
        }
      }

      markersMapRef.current.forEach((entry, id) => {
        if (!activeIds.has(id)) {
          entry.overlay?.setMap(null)
          markersMapRef.current.delete(id)
        }
      })

      if (!hasFitRiderBoundsRef.current && riders.length > 0 && map) {
        const bounds = new google.maps.LatLngBounds()
        riders.forEach((rider) => {
          if (isValidCoord(Number(rider.lat), Number(rider.lng))) {
            bounds.extend({ lat: Number(rider.lat), lng: Number(rider.lng) })
          }
        })
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, { top: 80, right: 320, bottom: 80, left: 80 })
          hasFitRiderBoundsRef.current = true
        }
      }
    },
    [openRiderInfo],
  )

  const drawAllZonesOnMap = useCallback((google, map) => {
    zonesPolygonsRef.current.forEach((polygon) => polygon?.setMap(null))
    zonesPolygonsRef.current = []
    zoneInfoWindowsRef.current.forEach((infoWindow) => infoWindow?.close())
    zoneInfoWindowsRef.current = []

    if (!zones?.length) return

    const colors = [
      "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
      "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
    ]
    const bounds = new google.maps.LatLngBounds()

    zones.forEach((zone, index) => {
      if (!zone.coordinates || zone.coordinates.length < 3) return

      const path = zone.coordinates
        .map((coord) => {
          const lat = typeof coord === "object" ? (coord.latitude ?? coord.lat) : null
          const lng = typeof coord === "object" ? (coord.longitude ?? coord.lng) : null
          if (lat == null || lng == null) return null
          const latLng = new google.maps.LatLng(lat, lng)
          bounds.extend(latLng)
          return latLng
        })
        .filter(Boolean)

      if (path.length < 3) return

      const color = colors[index % colors.length]
      const polygon = new google.maps.Polygon({
        paths: path,
        strokeColor: color,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: color,
        fillOpacity: 0.18,
        editable: false,
        draggable: false,
        clickable: true,
        zIndex: 1,
      })

      polygon.setMap(map)
      zonesPolygonsRef.current.push(polygon)

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 12px; min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1e293b;">
              ${escapeHtml(zone.name || "Unnamed Zone")}
            </h3>
            <div style="font-size: 13px; color: #64748b; line-height: 1.6;">
              <div><strong>Location:</strong> ${escapeHtml(zone.serviceLocation || "N/A")}</div>
              <div><strong>Status:</strong> ${zone.isActive ? "Active" : "Inactive"}</div>
            </div>
          </div>
        `,
      })

      polygon.addListener("click", () => {
        zoneInfoWindowsRef.current.forEach((iw) => iw?.close())
        infoWindow.setPosition(path[0])
        infoWindow.open(map)
        zoneInfoWindowsRef.current.push(infoWindow)
      })
    })

    if (!bounds.isEmpty() && !hasFitRiderBoundsRef.current) {
      map.fitBounds(bounds, { top: 80, right: 320, bottom: 80, left: 80 })
    }
  }, [zones])

  const focusRiderOnMap = useCallback((rider) => {
    if (!mapInstanceRef.current || !rider) return
    const lat = Number(rider.lat)
    const lng = Number(rider.lng)
    if (!isValidCoord(lat, lng)) return

    mapInstanceRef.current.panTo({ lat, lng })
    mapInstanceRef.current.setZoom(Math.max(mapInstanceRef.current.getZoom() || 14, 14))
    openRiderInfo(window.google, mapInstanceRef.current, rider)
  }, [openRiderInfo])

  const initializeMap = useCallback((google) => {
    if (!mapRef.current) return

    const map = new google.maps.Map(mapRef.current, {
      center: { lat: 20.5937, lng: 78.9629 },
      zoom: 5,
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
        position: google.maps.ControlPosition.TOP_RIGHT,
        mapTypeIds: [google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.SATELLITE],
      },
      zoomControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      scrollwheel: true,
      gestureHandling: "greedy",
      disableDoubleClickZoom: false,
    })

    mapInstanceRef.current = map
    setMapLoading(false)
  }, [])

  const loadGoogleMaps = useCallback(async () => {
    try {
      const apiKey = await getGoogleMapsApiKey()
      setGoogleMapsApiKey(apiKey || "loaded")

      let retries = 0
      while (!window.google && retries < 50) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        retries += 1
      }

      if (window.google?.maps) {
        initializeMap(window.google)
        return
      }

      if (apiKey) {
        const loader = new Loader({
          apiKey,
          version: "weekly",
          libraries: ["places", "drawing", "geometry"],
        })
        const google = await loader.load()
        initializeMap(google)
      } else {
        setMapLoading(false)
      }
    } catch (error) {
      console.error("Error loading Google Maps:", error)
      setMapLoading(false)
    }
  }, [initializeMap])

  useEffect(() => {
    fetchZones()
    fetchOnlineRidersFromApi()
    loadGoogleMaps()

    const apiInterval = setInterval(fetchOnlineRidersFromApi, API_REFRESH_MS)
    const unsubscribeRealtime = subscribeAllDeliveryLocations(
      applyFirebaseLocations,
      (error) => console.error("Firebase delivery listener failed:", error),
    )

    return () => {
      clearInterval(apiInterval)
      if (typeof unsubscribeRealtime === "function") unsubscribeRealtime()
      markersMapRef.current.forEach((entry) => {
        entry?.overlay?.setMap(null)
      })
      markersMapRef.current.clear()
      riderInfoWindowRef.current?.close()
    }
  }, [
    applyFirebaseLocations,
    fetchOnlineRidersFromApi,
    fetchZones,
    loadGoogleMaps,
  ])

  useEffect(() => {
    if (!mapLoading && mapInstanceRef.current && window.google?.maps?.places && autocompleteInputRef.current && !autocompleteRef.current) {
      const autocomplete = new window.google.maps.places.Autocomplete(autocompleteInputRef.current, {
        componentRestrictions: { country: "in" },
      })

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace()
        if (place.geometry?.location && mapInstanceRef.current) {
          mapInstanceRef.current.setCenter(place.geometry.location)
          mapInstanceRef.current.setZoom(12)
          setLocationSearch(place.formatted_address || place.name || "")
        }
      })

      autocompleteRef.current = autocomplete
    }
  }, [mapLoading])

  useEffect(() => {
    if (mapLoading || !mapInstanceRef.current || !window.google) return
    drawAllZonesOnMap(window.google, mapInstanceRef.current)
  }, [drawAllZonesOnMap, mapLoading, zones])

  useEffect(() => {
    if (mapLoading || !mapInstanceRef.current || !window.google) return
    updateDeliveryMarkers(window.google, mapInstanceRef.current, onlineRiders).catch((error) => {
      console.error("Error updating delivery markers:", error)
    })
  }, [mapLoading, onlineRiders, updateDeliveryMarkers])

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-4 lg:p-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate("/admin/food/zone-setup")}
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
            type="button"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center">
              <Bike className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Delivery Boy View</h1>
              <p className="text-sm text-slate-600">Live location of online delivery partners</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              ref={autocompleteInputRef}
              type="text"
              placeholder="Search location on map..."
              value={locationSearch}
              onChange={(e) => setLocationSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1" style={{ height: "calc(100vh - 250px)", minHeight: "600px" }}>
              <div ref={mapRef} className="w-full h-full rounded-lg" />

              {mapLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-100 rounded-lg">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
                    <p className="text-slate-600">Loading map...</p>
                  </div>
                </div>
              )}

              {!googleMapsApiKey && !mapLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-100 rounded-lg">
                  <div className="text-center p-6">
                    <MapPin className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-sm text-slate-600">Google Maps API key not found</p>
                  </div>
                </div>
              )}
            </div>

            <div className="w-full lg:w-72 shrink-0 border border-slate-200 rounded-lg bg-slate-50 overflow-hidden flex flex-col" style={{ minHeight: "600px", maxHeight: "calc(100vh - 250px)" }}>
              <div className="px-4 py-3 border-b border-slate-200 bg-white">
                <h3 className="text-sm font-semibold text-slate-900">Online Riders</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {ridersLoading ? "Loading..." : `${onlineRiders.length} on map`}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {ridersLoading ? (
                  <div className="text-center py-8 text-sm text-slate-500">Fetching riders...</div>
                ) : onlineRiders.length === 0 ? (
                  <div className="text-center py-8 px-3 text-sm text-amber-700 bg-amber-50 rounded-lg border border-amber-100">
                    No online riders with live location right now. Ask delivery partners to go online in the app.
                  </div>
                ) : (
                  onlineRiders.map((rider) => (
                    <button
                      key={rider._id}
                      type="button"
                      onClick={() => focusRiderOnMap(rider)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedRiderId === rider._id
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-slate-200 bg-white hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                          <span className="w-3 h-3 rounded-full bg-green-500 border-2 border-white shadow-sm" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{rider.name}</p>
                          <p className="text-xs text-slate-500 truncate">{rider.phone}</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Map Guide</h3>
            <div className="text-xs text-slate-600 space-y-1">
              <p>
                Each online rider appears as a <span className="font-semibold text-green-600">green dot with name</span> on the map.
              </p>
              <p>Click the icon or rider name in the list to see full details.</p>
              <p>
                Locations refresh live from the delivery app and update every 30 seconds.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
