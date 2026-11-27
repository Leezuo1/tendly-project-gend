/** Token và phiên bản Graph API từ env; null nếu thiếu hoặc sai dạng để mỗi caller tự báo lỗi theo cách riêng. */
export function graphCredentials(): { token: string; version: string } | null {
  const token = process.env.PAGE_ACCESS_TOKEN?.trim();
  const version = process.env.META_GRAPH_VERSION?.trim();
  return token && version && /^v\d+\.\d+$/.test(version) ? { token, version } : null;
}

export const graphUrl = (version: string, path: string) => `https://graph.facebook.com/${version}/${path}`;
