import {
  PatrolAssignmentSummaryListSchema,
  type PatrolAssignmentSummary,
} from "@wr/shared";

export async function fetchMyPatrolAssignments(): Promise<
  PatrolAssignmentSummary[]
> {
  let response: Response;
  try {
    response = await fetch("/api/patrol-assignments/mine", {
      credentials: "same-origin",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error(
      "We couldn’t load your patrols. Check your connection and try again.",
    );
  }

  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      data?.message ?? "The patrol service is unavailable. Please try again.",
    );

  const parsed = PatrolAssignmentSummaryListSchema.safeParse(data);
  if (!parsed.success)
    throw new Error("The patrol service returned an unexpected response.");
  return parsed.data;
}
