import { Routes, Route, Navigate, useLocation } from "react-router-dom"
import { useEffect, Suspense, lazy, useRef } from "react"
import Loader from "@food/components/Loader"
import AuthInitializer from "@food/components/AuthInitializer"
import PushSoundEnableButton from "@food/components/PushSoundEnableButton"
import { registerWebPushForCurrentModule } from "@food/utils/firebaseMessaging"

const UserRouter = lazy(() => import("@food/components/user/UserRouter"))
const AdminRouter = lazy(() => import("@food/components/admin/AdminRouter"))
const DeliveryRouter = lazy(() => import("../DeliveryV2"))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  const location = useLocation()
  const fcmRegisteredModulesRef = useRef(new Set())

  useEffect(() => {
    const path = location.pathname || ""
    let moduleName = "user"

    if (path.includes("/food/delivery") || path.includes("/delivery")) {
      moduleName = "delivery"
    } else if (path.includes("/food/admin") || path.includes("/admin")) {
      moduleName = "admin"
    }

    if (moduleName === "admin") return
    if (fcmRegisteredModulesRef.current.has(moduleName)) return

    registerWebPushForCurrentModule(location.pathname)
      .then(() => {
        fcmRegisteredModulesRef.current.add(moduleName)
      })
      .catch(() => {})
  }, [location.pathname])

  return (
    <AuthInitializer>
      <>
        <ScrollToTop />
        <PushSoundEnableButton />
        <Suspense fallback={<Loader />}>
          <Routes>
            <Route path="delivery/*" element={<DeliveryRouter />} />
            <Route path="user/food" element={<Navigate to="/food/user" replace />} />
            <Route path="user/*" element={<UserRouter />} />
            <Route path="admin/*" element={<AdminRouter />} />
            <Route path="/*" element={<UserRouter />} />
          </Routes>
        </Suspense>
      </>
    </AuthInitializer>
  )
}
