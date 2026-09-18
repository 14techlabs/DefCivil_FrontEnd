import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DataLoading } from "@/app/components/DataLoading";
import { EventsView } from "../EventsView";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isSafeInteger(eventId) || eventId < 1) notFound();
  return <Suspense fallback={<DataLoading />}><EventsView key={eventId} eventId={eventId} /></Suspense>;
}
