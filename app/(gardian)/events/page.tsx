import { Suspense } from "react";
import { DataLoading } from "@/app/components/DataLoading";
import { EventsView } from "./EventsView";

export default function EventsPage() {
  return <Suspense fallback={<DataLoading />}><EventsView /></Suspense>;
}
