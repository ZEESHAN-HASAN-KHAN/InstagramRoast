import { useEffect } from "react";

interface AdBannerProps {
  slot: string;
  format?: string;
}

export function AdBanner({ slot, format = "auto" }: AdBannerProps) {
  useEffect(() => {
    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch (e) {}
  }, []);

  return (
    <div className="my-6 flex justify-center overflow-hidden">
      <ins
        className="adsbygoogle"
        style={{ display: "block", width: "100%", maxWidth: "728px" }}
        data-ad-client="ca-pub-8535210422331864"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
