import type { TbhApi } from "../../shared/types";

declare global {
  interface Window {
    tbh: TbhApi;
  }
}

export {};
