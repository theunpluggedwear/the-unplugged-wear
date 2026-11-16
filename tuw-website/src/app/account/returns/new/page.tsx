import NewReturnView from '../_components/NewReturnView';

// ?order=ORD-… arrives from an order's "Return or exchange" block.
export default async function NewReturnPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  return <NewReturnView initialOrderNumber={order?.trim().toUpperCase() || undefined} />;
}
