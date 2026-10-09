'use client';

import { useState } from 'react';

export function CustomerAvatar({ name, initials, url, className }: {
  name: string; initials: string; url?: string; className: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string>();
  return <div className={className}>
    {url && url !== failedUrl ? (
      // Meta supplies signed CDN URLs; load directly rather than proxying/optimizing them on the server.
      // eslint-disable-next-line @next/next/no-img-element
      <img className="customer-avatar-image" src={url} alt={`Ảnh đại diện của ${name}`} width={56} height={56}
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
        loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedUrl(url)} />
    ) : initials}
  </div>;
}
