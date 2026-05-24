import { CheckoutPanel } from "@/components/reservations/checkout-panel";

export default async function ReservationPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Checkout hold</p>
        <h1 className="text-3xl font-semibold tracking-normal">Reservation details</h1>
      </div>
      <CheckoutPanel reservationId={id} />
    </div>
  );
}
