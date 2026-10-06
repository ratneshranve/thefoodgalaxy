import { AppShellSkeleton } from "@food/components/ui/loading-skeletons"

// In the native app (HashRouter) the route lives in the hash, not the pathname.
export const getCurrentAppPath = () => {
  if (typeof window === "undefined") return ""
  const hash = String(window.location.hash || "")
  const route = hash.startsWith("#/") ? hash.slice(1) : String(window.location.pathname || "")
  return route.split("?")[0].toLowerCase()
}

const NON_USER_APP_PATH = /^\/(?:food\/)?(?:restaurant|delivery)(?:\/|$)|^\/admin(?:\/|$)/

export default function Loader() {
  const path = getCurrentAppPath()
  if (
    path.includes('/terms') ||
    path.includes('/privacy') ||
    path.includes('/support')
  ) {
    return null
  }
  // Bug #23: restaurant / delivery / admin used to flash the user app's home
  // skeleton while their code loaded. Show a plain screen instead.
  if (NON_USER_APP_PATH.test(path)) {
    return <div className="min-h-screen w-full bg-white dark:bg-[#0a0a0a]" aria-busy="true" aria-label="Loading" />
  }
  return <AppShellSkeleton />
}
