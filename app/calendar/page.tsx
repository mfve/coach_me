import { Suspense } from "react";
import TrainingCalendar from "@/components/TrainingCalendar";

export default function CalendarPage() {
  return (
    <Suspense>
      <TrainingCalendar />
    </Suspense>
  );
}
