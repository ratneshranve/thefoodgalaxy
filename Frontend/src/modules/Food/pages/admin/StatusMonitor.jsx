import React, { useState, useEffect, useRef } from 'react';
import api from '@food/api/axios';
import { getGoogleMapsApiKey } from '@food/utils/googleMapsApiKey';
import { Loader } from '@googlemaps/js-api-loader';
import { Loader2, MapPin, Clock, Package, CheckCircle2, Navigation, ShoppingBag, Truck } from 'lucide-react';
import { toast } from 'sonner';

export default function StatusMonitor() {
  const [activeTab, setActiveTab] = useState('restaurants'); // 'restaurants' or 'delivery'
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ restaurants: [], deliveryPartners: [] });
  const [selectedItem, setSelectedItem] = useState(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await api.get('/food/admin/live-monitor/status');
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (err) {
      toast.error('Failed to load live monitor status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSelectedItem(null);
  };

  const getList = () => {
    return activeTab === 'restaurants' ? data.restaurants : data.deliveryPartners;
  };

  const list = getList();

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-gray-50 p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Live Status Monitor</h1>
        <div className="bg-white p-1 rounded-lg shadow-sm inline-flex border border-gray-200">
          <button
            onClick={() => handleTabChange('restaurants')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'restaurants' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Restaurants ({data.restaurants.length})
          </button>
          <button
            onClick={() => handleTabChange('delivery')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'delivery' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Delivery Partners ({data.deliveryPartners.length})
          </button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Left Panel: List */}
        <div className="w-1/3 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="font-semibold text-gray-700">Online {activeTab === 'restaurants' ? 'Restaurants' : 'Partners'}</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {loading && list.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : list.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                No {activeTab === 'restaurants' ? 'restaurants' : 'delivery partners'} online
              </div>
            ) : (
              <ul className="space-y-2">
                {list.map((item) => (
                  <li
                    key={item._id}
                    onClick={() => setSelectedItem(item)}
                    className={`p-3 rounded-lg cursor-pointer transition-all border ${
                      selectedItem?._id === item._id
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-transparent hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {activeTab === 'restaurants' ? (
                        <div className="w-10 h-10 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0">
                          {item.logo ? <img src={item.logo} className="w-full h-full object-cover" alt="" /> : <ShoppingBag className="w-5 h-5 m-auto text-gray-400 mt-2.5" />}
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                          {item.profilePhoto ? <img src={item.profilePhoto} className="w-full h-full object-cover" alt="" /> : <Truck className="w-5 h-5 m-auto text-gray-400 mt-2.5" />}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {activeTab === 'restaurants' ? item.restaurantName : item.name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {activeTab === 'restaurants' ? `${item.area || ''}, ${item.city || ''}` : item.phone}
                        </p>
                      </div>
                      <div className="flex items-center">
                        <span className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right Panel: Details */}
        <div className="flex-1 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          {!selectedItem ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Navigation className="w-12 h-12 mb-4 text-gray-300" />
              <p>Select an item from the list to view live details</p>
            </div>
          ) : activeTab === 'restaurants' ? (
            <RestaurantDetails restaurant={selectedItem} />
          ) : (
            <DeliveryPartnerDetails partner={selectedItem} />
          )}
        </div>
      </div>
    </div>
  );
}

function RestaurantDetails({ restaurant }) {
  const { stats, schedules } = restaurant;
  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
        <div className="w-20 h-20 rounded-xl bg-gray-100 overflow-hidden shadow-sm">
          {restaurant.logo ? <img src={restaurant.logo} className="w-full h-full object-cover" alt="" /> : <ShoppingBag className="w-8 h-8 m-auto text-gray-400 mt-6" />}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{restaurant.restaurantName}</h2>
          <p className="text-gray-500 flex items-center gap-1 mt-1">
            <MapPin className="w-4 h-4" />
            {restaurant.addressLine1}, {restaurant.area}, {restaurant.city}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-col items-center justify-center">
          <Package className="w-6 h-6 text-blue-500 mb-2" />
          <p className="text-sm text-blue-600 font-medium">Total Orders Today</p>
          <p className="text-2xl font-bold text-blue-700">{stats.totalOrders || 0}</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex flex-col items-center justify-center">
          <CheckCircle2 className="w-6 h-6 text-green-500 mb-2" />
          <p className="text-sm text-green-600 font-medium">Delivered Today</p>
          <p className="text-2xl font-bold text-green-700">{stats.deliveredOrders || 0}</p>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex flex-col items-center justify-center">
          <Clock className="w-6 h-6 text-orange-500 mb-2" />
          <p className="text-sm text-orange-600 font-medium">Active Orders</p>
          <p className="text-2xl font-bold text-orange-700">{stats.activeOrders || 0}</p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-500" />
          Working Hours
        </h3>
        {schedules && schedules.length > 0 ? (
          <div className="grid grid-cols-2 gap-y-3">
            {schedules.map((schedule, idx) => (
              <div key={idx} className="flex flex-col">
                <span className="text-sm font-medium text-gray-700 capitalize">{schedule.day}</span>
                <span className="text-sm text-gray-500">
                  {schedule.slots?.map(slot => `${slot.open} - ${slot.close}`).join(', ') || 'Closed'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No schedule defined</p>
        )}
      </div>
    </div>
  );
}



function DeliveryPartnerDetails({ partner }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    setShowMap(false);
  }, [partner]);

  useEffect(() => {
    if (!showMap) return;
    let isMounted = true;
    const initMap = async () => {
      try {
        const apiKey = await getGoogleMapsApiKey();
        
        let google = window.google;
        if (!google) {
          if (apiKey) {
            const loader = new Loader({
              apiKey: apiKey,
              version: "weekly",
              libraries: ["geometry"]
            });
            google = await loader.load();
          }
        }

        if (google && isMounted && mapRef.current) {
          const lat = partner.lastLat || 20.5937;
          const lng = partner.lastLng || 78.9629;
          const position = { lat, lng };

          if (!mapInstanceRef.current) {
            mapInstanceRef.current = new google.maps.Map(mapRef.current, {
              center: position,
              zoom: partner.lastLat ? 15 : 5,
              mapTypeControl: false,
              streetViewControl: false,
            });
          } else {
            mapInstanceRef.current.setCenter(position);
            mapInstanceRef.current.setZoom(partner.lastLat ? 15 : 5);
          }

          if (partner.lastLat && partner.lastLng) {
            if (!markerRef.current) {
              markerRef.current = new google.maps.Marker({
                position,
                map: mapInstanceRef.current,
                title: partner.name,
              });
            } else {
              markerRef.current.setPosition(position);
            }
          }
          setMapLoading(false);
        }
      } catch (err) {
        console.error("Error loading map:", err);
        if (isMounted) setMapLoading(false);
      }
    };

    initMap();

    return () => {
      isMounted = false;
    };
  }, [partner, showMap]);

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100 flex-shrink-0">
        <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden shadow-sm">
          {partner.profilePhoto ? <img src={partner.profilePhoto} className="w-full h-full object-cover" alt="" /> : <Truck className="w-8 h-8 m-auto text-gray-400 mt-4" />}
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">{partner.name}</h2>
          <p className="text-gray-500">{partner.phone}</p>
          <p className="text-sm text-gray-400">Vehicle: {partner.vehicleType} ({partner.vehicleNumber})</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 flex-shrink-0">
        <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex flex-col items-center justify-center">
          <CheckCircle2 className="w-6 h-6 text-green-500 mb-2" />
          <p className="text-sm text-green-600 font-medium">Delivered Today</p>
          <p className="text-2xl font-bold text-green-700">{partner.deliveredToday || 0}</p>
        </div>
        <div className={`border rounded-xl p-4 flex flex-col items-center justify-center ${partner.currentOrder ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-100'}`}>
          <Package className={`w-6 h-6 mb-2 ${partner.currentOrder ? 'text-orange-500' : 'text-gray-400'}`} />
          <p className={`text-sm font-medium ${partner.currentOrder ? 'text-orange-600' : 'text-gray-500'}`}>Current Status</p>
          <p className={`text-lg font-bold ${partner.currentOrder ? 'text-orange-700' : 'text-gray-600'}`}>
            {partner.currentOrder ? `Has Active Order` : 'Free'}
          </p>
        </div>
      </div>

      <div className="flex-1 bg-gray-100 rounded-xl overflow-hidden border border-gray-200 relative">
        {!showMap ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
            <MapPin className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-gray-500 mb-6 max-w-xs">
              Click below to view the live location on the map. This helps save map API usage when not needed.
            </p>
            <button
              onClick={() => setShowMap(true)}
              className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium shadow-sm hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <Navigation className="w-4 h-4" />
              Track Location
            </button>
          </div>
        ) : (
          <>
            <div ref={mapRef} className="absolute inset-0 w-full h-full" />
            
            {mapLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}

            {!mapLoading && (!partner.lastLat || !partner.lastLng) && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 backdrop-blur-sm">
                <div className="text-center bg-white p-4 rounded-lg shadow-sm">
                  <MapPin className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Location not available</p>
                </div>
              </div>
            )}
            
            {partner.lastLocationAt && (
              <div className="absolute bottom-4 left-4 bg-white px-3 py-1.5 rounded-md shadow-md text-xs font-medium text-gray-600 z-10 border border-gray-200">
                Updated: {new Date(partner.lastLocationAt).toLocaleTimeString()}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
