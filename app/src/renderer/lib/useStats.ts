import { useEffect, useState } from "react";
import type { Stats } from "../../../shared/types";

// Subscribes to the live stats stream pushed from the main process.
export function useStats(): Stats | null {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let mounted = true;
    window.tbh
      .getStats()
      .then((s) => {
        if (mounted && s) setStats(s);
      })
      .catch(() => {
        /* ignore - first push will populate */
      });
    const off = window.tbh.onStats((s) => setStats(s));
    return () => {
      mounted = false;
      off();
    };
  }, []);

  return stats;
}
