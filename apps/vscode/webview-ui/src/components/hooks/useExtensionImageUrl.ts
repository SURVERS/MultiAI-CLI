import { useEffect, useState } from "react";

export function useExtensionImageUrl(imageName: string): string {
  const [url, setUrl] = useState("");

  useEffect(() => {
    const baseUri = document.body.dataset.baseuri;
    if (baseUri) {
      setUrl(`${baseUri}/dist/${imageName}`);
    }
  }, [imageName]);

  return url;
}
