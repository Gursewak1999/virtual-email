import { notFound } from "next/navigation";

import { PublicBookingClient } from "@/features/consultations/booking/public-booking-client";
import { getPublicBookingPayload } from "@/features/consultations/lib/server";

export const dynamic = "force-dynamic";

interface BookingPageProps {
  params: Promise<{ slug: string }>;
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { slug } = await params;
  const booking = await getPublicBookingPayload(slug);

  if (!booking) {
    notFound();
  }

  return <PublicBookingClient initialBooking={booking} />;
}
