import { useEffect } from "react";
import { registerTools } from "@nekuda/webmcp-sdk";
import { apartmentWebMCPTools } from "./tools";

/** Register the apartment journeys for this page's lifetime. */
export function WebMCPRegistrar() {
  useEffect(() => {
    const registration = registerTools([...apartmentWebMCPTools]);
    return () => registration.unregister();
  }, []);

  return null;
}
