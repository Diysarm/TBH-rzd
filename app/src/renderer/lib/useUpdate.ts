import { useEffect, useState } from "react";
import type { UpdateStatus } from "../../../shared/types";
import { reportIpcError } from "./reportError";

export function useUpdate(): UpdateStatus | null {
  const [status, setStatus] = useState<UpdateStatus | null>(null);

  useEffect(() => {
    let mounted = true;

    void window.tbh
      .getUpdateStatus()
      .then((s) => {
        if (mounted) setStatus(s);
      })
      .catch(reportIpcError);

    const off = window.tbh.onUpdateStatus((s) => {
      if (mounted) setStatus(s);
    });

    return () => {
      mounted = false;
      off();
    };
  }, []);

  return status;
}
