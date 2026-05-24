"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, RotateCcw, XCircle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ApiErrorResponse, ReservationResponse } from "@/types/api";

export function CheckoutPanel({ reservationId }: { reservationId: string }) {
  const router = useRouter();
  const [reservation, setReservation] = useState<ReservationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"confirm" | "release" | null>(null);
  const [now, setNow] = useState(Date.now());
  const [, startRefresh] = useTransition();

  const loadReservation = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/reservations/${reservationId}`, { cache: "no-store" });
      const body = (await response.json()) as ReservationResponse | ApiErrorResponse;
      if (!response.ok) {
        throw new Error("error" in body ? body.error : "Unable to load reservation");
      }
      setReservation(body as ReservationResponse);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load reservation");
    } finally {
      setLoading(false);
    }
  }, [reservationId]);

  useEffect(() => {
    void loadReservation();
  }, [loadReservation]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const secondsLeft = useMemo(() => {
    if (!reservation) return 0;
    return Math.max(0, Math.ceil((new Date(reservation.expiresAt).getTime() - now) / 1000));
  }, [now, reservation]);

  async function mutate(nextAction: "confirm" | "release") {
    setAction(nextAction);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/reservations/${reservationId}/${nextAction}`, {
        method: "POST"
      });
      const body = (await response.json()) as ReservationResponse | ApiErrorResponse;
      if (!response.ok) {
        const message =
          response.status === 410
            ? "HTTP 410: this reservation expired before it could be confirmed."
            : response.status === 409
              ? "HTTP 409: inventory changed and this action could not be completed."
              : "error" in body
                ? body.error
                : "Action failed";
        throw new Error(message);
      }

      setReservation(body as ReservationResponse);
      setSuccess(nextAction === "confirm" ? "Purchase confirmed." : "Reservation released.");
      startRefresh(() => router.refresh());
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Action failed");
      await loadReservation();
    } finally {
      setAction(null);
    }
  }

  if (loading && !reservation) {
    return <Alert>Loading reservation...</Alert>;
  }

  if (!reservation) {
    return (
      <div className="space-y-4">
        {error && <Alert variant="destructive">{error}</Alert>}
        <Button asChild variant="outline">
          <Link href="/">Back to inventory</Link>
        </Button>
      </div>
    );
  }

  const isPending = reservation.status === "PENDING";

  return (
    <section className="max-w-2xl rounded-md border bg-card p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{reservation.product.name}</h2>
          <p className="text-sm text-muted-foreground">
            {reservation.warehouse.name} · {reservation.warehouse.location}
          </p>
        </div>
        <Badge
          variant={
            reservation.status === "CONFIRMED"
              ? "default"
              : reservation.status === "RELEASED"
                ? "secondary"
                : "destructive"
          }
        >
          {reservation.status}
        </Badge>
      </div>

      <div className="grid gap-3 border-y py-4 text-sm sm:grid-cols-3">
        <div>
          <div className="text-muted-foreground">Quantity</div>
          <div className="text-lg font-semibold">{reservation.quantity}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Expires</div>
          <div className="text-lg font-semibold">
            {new Date(reservation.expiresAt).toLocaleTimeString()}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Time left</div>
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Clock className="h-4 w-4" />
            {isPending ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}` : "Done"}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {error && <Alert variant="destructive">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        <div className="flex flex-wrap gap-3">
          <Button disabled={!isPending || action !== null} onClick={() => void mutate("confirm")}>
            <CheckCircle2 className="h-4 w-4" />
            {action === "confirm" ? "Confirming" : "Confirm purchase"}
          </Button>
          <Button
            variant="outline"
            disabled={!isPending || action !== null}
            onClick={() => void mutate("release")}
          >
            <XCircle className="h-4 w-4" />
            {action === "release" ? "Cancelling" : "Cancel reservation"}
          </Button>
          <Button asChild variant="secondary">
            <Link href="/">
              <RotateCcw className="h-4 w-4" />
              Inventory
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
