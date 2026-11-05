import { redirect } from 'next/navigation';

export default async function FaqPage({ searchParams }: { searchParams: Promise<{ tab?: string; shopee?: string }> }) {
  const params = await searchParams;
  const tab = params.tab === 'email' ? 'tags' : params.tab && ['products', 'faq', 'tags'].includes(params.tab) ? params.tab : 'faq';
  const query = new URLSearchParams({ tab });
  if (params.shopee === 'connected') query.set('shopee', 'connected');
  redirect(`/cai-dat?${query}`);
}
