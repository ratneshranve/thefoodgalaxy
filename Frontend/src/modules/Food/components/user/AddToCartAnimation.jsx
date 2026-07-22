import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useCart } from "@food/context/CartContext";
import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { Trash2, ChevronRight } from 'lucide-react';
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}



/**
 * AddToCartAnimation Component
 * 
 * A self-contained component that handles:
 * - Fly-to-cart animation when products are added
 * - Bounce-out animation when products are removed
 * - Pulse animation on cart changes
 * - "View cart" button display at bottom center
 * 
 * This component automatically integrates with the CartContext and
 * listens for cart changes to trigger appropriate animations.
 */
export default function AddToCartAnimation({
  bottomOffset = 96,
  pillClassName = '',
  hideOnPages = true,
  linkTo = '/food/user/cart',
  dynamicBottom = null,
}) {
  const { cart, items, itemCount, total, lastAddEvent, lastRemoveEvent, clearCart } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const linkRef = useRef(null);
  const [removedProduct, setRemovedProduct] = useState(null);
  const [flyingProduct, setFlyingProduct] = useState(null);
  const removedThumbnailRef = useRef(null);
  const flyingThumbnailRef = useRef(null);
  const prevItemsRef = useRef(items);

  // Get restaurant info from first cart item
  const restaurantName = cart[0]?.restaurant || "Restaurant";
  const restaurantImage = cart[0]?.image || "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=200&h=200&fit=crop";
  const restaurantSlug = restaurantName.toLowerCase().replace(/\s+/g, "-");

  // Hide pill on cart pages, order pages, and account page (if enabled)
  const iscartPage = location.pathname === '/cart' ||
    location.pathname === '/user/cart' ||
    location.pathname.startsWith('/cart/') ||
    location.pathname.startsWith('/user/cart/');
  const isOrderPage = location.pathname.startsWith('/orders/');
  const isAccountPage = location.pathname === '/account';
  const shouldHidePill = hideOnPages && (iscartPage || isOrderPage || isAccountPage);

  // Handle removal animation when product is removed
  useEffect(() => {
    if (lastRemoveEvent && lastRemoveEvent.sourcePosition && linkRef.current) {
      const { product, sourcePosition } = lastRemoveEvent;

      // Store the sourcePosition immediately to prevent it from being lost
      const savedSourcePosition = { ...sourcePosition };
      const savedProduct = { ...product };

      setRemovedProduct({ product: savedProduct, targetPos: savedSourcePosition });

      // Wait a bit to ensure pill is rendered
      setTimeout(() => {
        if (removedThumbnailRef.current && linkRef.current) {
          const thumbnail = removedThumbnailRef.current;
          // Get fresh position of the pill (viewport-relative)
          const pillRect = linkRef.current.getBoundingClientRect();
          // Start position: center of the pill (where thumbnails are)
          const startX = pillRect.left + 16; // Approximate position of first thumbnail
          const startY = pillRect.top + pillRect.height / 2; // Vertical center of pill

          // Calculate current viewport position accounting for scroll changes
          // Check multiple sources to get accurate scroll position
          const getScrollX = () => {
            if (window.scrollX !== undefined) return window.scrollX
            if (window.pageXOffset !== undefined) return window.pageXOffset
            if (document.documentElement && document.documentElement.scrollLeft !== undefined) {
              return document.documentElement.scrollLeft
            }
            if (document.body && document.body.scrollLeft !== undefined) {
              return document.body.scrollLeft
            }
            return 0
          }

          const getScrollY = () => {
            if (window.scrollY !== undefined) return window.scrollY
            if (window.pageYOffset !== undefined) return window.pageYOffset
            if (document.documentElement && document.documentElement.scrollTop !== undefined) {
              return document.documentElement.scrollTop
            }
            if (document.body && document.body.scrollTop !== undefined) {
              return document.body.scrollTop
            }
            return 0
          }

          const currentScrollX = getScrollX()
          const currentScrollY = getScrollY()

          // Determine target position (support both new format with viewportX/Y and old format with x/y)
          let targetX, targetY

          if (savedSourcePosition.viewportX !== undefined && savedSourcePosition.viewportY !== undefined) {
            // New format: stored viewport position + scroll at capture time
            // Adjust for scroll changes since capture
            const scrollDeltaX = currentScrollX - (savedSourcePosition.scrollX || 0)
            const scrollDeltaY = currentScrollY - (savedSourcePosition.scrollY || 0)
            // If page scrolled right/down, button moved left/up in viewport
            targetX = savedSourcePosition.viewportX - scrollDeltaX
            targetY = savedSourcePosition.viewportY - scrollDeltaY
          } else {
            // Old format: document-relative position (backward compatibility)
            targetX = savedSourcePosition.x - currentScrollX
            targetY = savedSourcePosition.y - currentScrollY
          }

          // Calculate thumbnail center offset (16px = half of 32px thumbnail)
          const thumbnailCenterOffset = 16;

          // Position at pill location initially (viewport-relative)
          gsap.set(thumbnail, {
            position: 'fixed',
            left: startX - thumbnailCenterOffset,
            top: startY - thumbnailCenterOffset,
            zIndex: 1000,
            scale: 1,
            rotation: 0,
            opacity: 1,
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            x: 0,
            y: 0,
          });

          // Calculate relative movement from pill to source position
          // Both positions are now viewport-relative
          const deltaX = targetX - startX;
          const deltaY = targetY - startY;

          // Fly back to source animation
          const tl = gsap.timeline({
            onComplete: () => {
              setRemovedProduct(null);
            },
          });

          // Step 1: Pop out from pill (scale up slightly)
          tl.to(thumbnail, {
            scale: 1.3,
            duration: 0.15,
            ease: 'power2.out',
          })
            // Step 2: Fly towards source with rotation
            .to(thumbnail, {
              x: deltaX * 0.98, // Slight overshoot for bounce
              y: deltaY,
              rotation: -360,
              scale: 1.1,
              duration: 0.4,
              ease: 'power2.inOut',
            })
            // Step 3: Bounce back slightly
            .to(thumbnail, {
              x: deltaX,
              y: deltaY,
              scale: 0.9,
              duration: 0.15,
              ease: 'power2.out',
            })
            // Step 4: Final bounce into position
            .to(thumbnail, {
              scale: 0.85,
              duration: 0.1,
              ease: 'power2.in',
            })
            // Step 5: Fade out smoothly
            .to(thumbnail, {
              scale: 0.7,
              opacity: 0,
              duration: 0.15,
              ease: 'power2.in',
            });
        }
      }, 10);
    }
  }, [lastRemoveEvent]);

  // Handle fly-to-cart animation when product is added
  useEffect(() => {
    if (lastAddEvent && lastAddEvent.sourcePosition && linkRef.current) {
      const { product, sourcePosition } = lastAddEvent;

      // Store the sourcePosition immediately to prevent it from being lost
      const savedSourcePosition = { ...sourcePosition };
      const savedProduct = { ...product };

      setFlyingProduct({ product: savedProduct, startPos: savedSourcePosition });

      // Wait a bit longer to ensure pill is fully rendered and in position
      setTimeout(() => {
        if (flyingThumbnailRef.current && linkRef.current) {
          const thumbnail = flyingThumbnailRef.current;
          // Get fresh position after pill animation completes
          const pillRect = linkRef.current.getBoundingClientRect();
          // Target position: center of the pill (viewport-relative)
          const endX = pillRect.left + pillRect.width / 2; // Horizontal center of pill
          const endY = pillRect.top + pillRect.height / 2; // Vertical center of pill

          // Calculate current viewport position accounting for scroll changes
          // Check multiple sources to get accurate scroll position
          const getScrollX = () => {
            if (window.scrollX !== undefined) return window.scrollX
            if (window.pageXOffset !== undefined) return window.pageXOffset
            if (document.documentElement && document.documentElement.scrollLeft !== undefined) {
              return document.documentElement.scrollLeft
            }
            if (document.body && document.body.scrollLeft !== undefined) {
              return document.body.scrollLeft
            }
            return 0
          }

          const getScrollY = () => {
            if (window.scrollY !== undefined) return window.scrollY
            if (window.pageYOffset !== undefined) return window.pageYOffset
            if (document.documentElement && document.documentElement.scrollTop !== undefined) {
              return document.documentElement.scrollTop
            }
            if (document.body && document.body.scrollTop !== undefined) {
              return document.body.scrollTop
            }
            return 0
          }

          const currentScrollX = getScrollX()
          const currentScrollY = getScrollY()

          // Determine source position (support both new format with viewportX/Y and old format with x/y)
          let sourceX, sourceY

          if (savedSourcePosition.viewportX !== undefined && savedSourcePosition.viewportY !== undefined) {
            // New format: stored viewport position + scroll at capture time
            // Adjust for scroll changes since capture
            const scrollDeltaX = currentScrollX - (savedSourcePosition.scrollX || 0)
            const scrollDeltaY = currentScrollY - (savedSourcePosition.scrollY || 0)
            // If page scrolled right/down, button moved left/up in viewport
            sourceX = savedSourcePosition.viewportX - scrollDeltaX
            sourceY = savedSourcePosition.viewportY - scrollDeltaY
          } else {
            // Old format: document-relative position (backward compatibility)
            sourceX = savedSourcePosition.x - currentScrollX
            sourceY = savedSourcePosition.y - currentScrollY
          }

          // Calculate thumbnail center offset (16px = half of 32px thumbnail)
          const thumbnailCenterOffset = 16;

          // Position at source (center of button) - use viewport-relative position
          // Set initial position so the center of thumbnail is at sourcePosition
          gsap.set(thumbnail, {
            position: 'fixed',
            left: sourceX - thumbnailCenterOffset,
            top: sourceY - thumbnailCenterOffset,
            zIndex: 1000,
            scale: 1,
            rotation: 0,
            opacity: 1,
            width: '32px',
            height: '32px',
            borderRadius: '50%', // Ensure circular
            x: 0,
            y: 0,
          });

          // Fly to cart animation with bounce
          const tl = gsap.timeline({
            onComplete: () => {
              setFlyingProduct(null);
            },
          });

          // Calculate relative movement from source center to target center
          // Both positions are now viewport-relative, so delta is direct
          const deltaX = endX - sourceX;
          const deltaY = endY - sourceY;

          // Step 1: Pop out from button (scale up slightly)
          tl.to(thumbnail, {
            scale: 1.3,
            duration: 0.15,
            ease: 'power2.out',
          })
            // Step 2: Fly towards cart with rotation (no Y overshoot to prevent going below)
            .to(thumbnail, {
              x: deltaX * 0.98, // Slight X overshoot for bounce
              y: deltaY, // No overshoot on Y to prevent going below pill
              rotation: 360,
              scale: 1.1,
              duration: 0.4,
              ease: 'power2.inOut',
            })
            // Step 3: Bounce back slightly on X only (overshoot correction)
            .to(thumbnail, {
              x: deltaX,
              y: deltaY, // Keep Y at exact target
              scale: 0.9,
              duration: 0.15,
              ease: 'power2.out',
            })
            // Step 4: Final bounce into position
            .to(thumbnail, {
              scale: 0.85,
              duration: 0.1,
              ease: 'power2.in',
            })
            // Step 5: Fade out smoothly
            .to(thumbnail, {
              scale: 0.7,
              opacity: 0,
              duration: 0.15,
              ease: 'power2.in',
            });
        }
      }, 150); // Increased delay to ensure pill animation completes
    }
  }, [lastAddEvent]);

  // Enhanced GSAP pulse animation when cart changes (but not on removal or fly-to-cart)
  useEffect(() => {
    if (itemCount > 0 && linkRef.current && !removedProduct && !flyingProduct && !lastRemoveEvent) {
      // Kill any existing animations first
      gsap.killTweensOf(linkRef.current);

      // Enhanced pulse animation with glow effect
      const tl = gsap.timeline();

      // Step 1: Scale up with glow
      tl.to(linkRef.current, {
        scale: 1.08,
        boxShadow: '0 10px 25px rgba(126, 56, 102, 0.4)',
        duration: 0.15,
        ease: 'power2.out',
        transformOrigin: 'center center',
        force3D: true,
      })
        // Step 2: Bounce back
        .to(linkRef.current, {
          scale: 1.0,
          boxShadow: '0 4px 12px rgba(126, 56, 102, 0.3)',
          duration: 0.2,
          ease: 'power2.inOut',
        })
        // Step 3: Subtle second pulse
        .to(linkRef.current, {
          scale: 1.04,
          duration: 0.1,
          ease: 'power1.out',
        })
        .to(linkRef.current, {
          scale: 1.0,
          duration: 0.15,
          ease: 'power1.in',
        });
    }
  }, [itemCount, total, removedProduct, flyingProduct, lastRemoveEvent]);

  // Get up to 3 most recently added items for thumbnails
  // Since items are added to the end of the array, we take the last 3
  const safeItems = Array.isArray(items) ? items : [];
  const thumbnailItems = safeItems
    .slice(-3)
    .reverse()
    .filter((item) => item && typeof item === 'object');

  return (
    <>
      {/* Removed product thumbnail - flying back to source */}
      {removedProduct && (
        <div
          ref={removedThumbnailRef}
          className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-white flex-shrink-0 shadow-lg"
          style={{
            borderRadius: '50%',
            objectFit: 'cover',
          }}
        >
          {removedProduct.product?.imageUrl ? (
            <img
              src={removedProduct.product.imageUrl}
              alt={removedProduct.product.name}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-neutral-200 text-neutral-400 text-xs font-semibold rounded-full">
              {removedProduct.product?.name?.charAt(0).toUpperCase() || '?'}
            </div>
          )}
        </div>
      )}

      {/* Flying product thumbnail - going to cart */}
      {flyingProduct && (
        <div
          ref={flyingThumbnailRef}
          className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-white flex-shrink-0 shadow-lg"
          style={{
            borderRadius: '50%',
            objectFit: 'cover',
          }}
        >
          {flyingProduct?.product?.imageUrl ? (
            <img
              src={flyingProduct.product.imageUrl}
              alt={flyingProduct?.product?.name || 'Item'}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-neutral-200 text-neutral-400 text-xs font-semibold rounded-full">
              {flyingProduct?.product?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {itemCount > 0 && !shouldHidePill && (
          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.8 }}
            animate={{
              y: 0,
              opacity: 1,
              scale: 1,
            }}
            exit={{ y: 60, opacity: 0, scale: 0.8 }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 30,
              mass: 0.8,
            }}
            style={{
              position: 'fixed',
              bottom: dynamicBottom ? undefined : `${bottomOffset || 20}px`,
              pointerEvents: 'none',
            }}
            className={`left-0 right-0 z-[9999] flex justify-center px-4 pb-4 md:pb-6 transition-all duration-300 ease-in-out bg-transparent pointer-events-none ${dynamicBottom || ''}`}
          >
            {/* The main container - New Design (StickyCartCard style) */}
            <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-2.5 md:p-3 flex items-center gap-2.5 md:gap-3 border border-gray-100 pointer-events-auto mx-auto w-full max-w-[95vw] md:max-w-sm">
              
              {/* Item Images Stack */}
              <div className="flex -space-x-3 md:-space-x-4 flex-shrink-0 ml-1">
                {cart.slice(0, 3).map((item, i) => (
                  <div 
                    key={item.id || i} 
                    className="w-11 h-11 md:w-12 md:h-12 rounded-full overflow-hidden border-2 border-white shadow-sm bg-white"
                    style={{ zIndex: 10 - i }}
                  >
                    <img
                      src={item.image || item.imageUrl || restaurantImage}
                      alt={item.name || "Item"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
                {cart.length > 3 && (
                  <div 
                    className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-gray-50 border-2 border-white flex items-center justify-center text-[11px] font-bold text-gray-500 shadow-sm"
                    style={{ zIndex: 10 - 3 }}
                  >
                    +{cart.length - 3}
                  </div>
                )}
              </div>

              {/* Restaurant Info */}
              <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
                <h3 className="font-bold text-gray-900 text-sm md:text-[15px] line-clamp-1 leading-tight mb-1">
                  {restaurantName}
                </h3>
                <button 
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/food/user/restaurants/${restaurantSlug}`); }}
                  className="bg-[#fff0e6] text-[#ff7a29] rounded-full px-2.5 py-0.5 text-[10px] md:text-[11px] font-bold inline-flex items-center gap-0.5 w-fit hover:bg-orange-100 transition-colors"
                >
                  Menu <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {/* Checkout Button (Green) */}
              <motion.button
                ref={linkRef}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate(linkTo);
                }}
                className="bg-[#1da05c] hover:bg-[#188c50] text-white rounded-2xl px-3.5 py-1.5 md:py-2 flex flex-col items-center justify-center shadow-sm transition-colors flex-shrink-0 min-w-[100px] md:min-w-[110px]"
              >
                <span className="text-[10px] md:text-[11px] font-medium text-white/90 leading-tight mb-0.5">
                  {itemCount} {itemCount === 1 ? 'item' : 'items'} | ₹{total}
                </span>
                <span className="text-[14px] md:text-[15px] font-bold leading-tight">Checkout</span>
              </motion.button>

              {/* Delete/Clear Cart Button (Pink) */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  clearCart();
                }}
                className="bg-[#ffe8ea] hover:bg-[#ffd1d6] text-[#ff4b5c] rounded-2xl p-2.5 md:p-3 flex items-center justify-center transition-colors flex-shrink-0 mr-1"
              >
                <Trash2 className="w-[18px] h-[18px] md:w-5 md:h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

