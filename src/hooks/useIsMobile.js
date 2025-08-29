import { useState, useEffect } from "react";

/**
 * useIsMobile - detects if the viewport width is <= breakpoint (default 768px)
 * @param {number} breakpoint - Max width in px for mobile (default: 768)
 * @returns {boolean} isMobile
 */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= breakpoint);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= breakpoint);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [breakpoint]);

  return isMobile;
}
