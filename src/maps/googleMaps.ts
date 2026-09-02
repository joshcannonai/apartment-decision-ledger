type GoogleMapUrlsInput = {
  origin: string;
  destination?: string | null;
  embedApiKey?: string | null;
};

export function buildGoogleMapUrls({ origin, destination, embedApiKey }: GoogleMapUrlsInput) {
  const key = embedApiKey?.trim();
  const openUrl = destination
    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(origin)}`;

  if (key) {
    const mode = destination ? "directions" : "place";
    const parameters = destination
      ? `origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=walking`
      : `q=${encodeURIComponent(origin)}`;
    return {
      embedUrl: `https://www.google.com/maps/embed/v1/${mode}?key=${encodeURIComponent(key)}&${parameters}`,
      openUrl,
      embedMode: "official_api" as const,
    };
  }

  return {
    embedUrl: `https://maps.google.com/maps?output=embed&q=${encodeURIComponent(origin)}&z=14`,
    openUrl,
    embedMode: "personal_list_fallback" as const,
  };
}
