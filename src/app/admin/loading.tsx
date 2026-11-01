import { HeaderSkeleton, ListSkeleton, LoadingRegion } from "@/components/loading/skeletons"

export default function Loading() {
  return (
    <LoadingRegion label="Loading">
      <div className="grid gap-6">
        <HeaderSkeleton />
        <ListSkeleton rows={6} className="h-16" />
      </div>
    </LoadingRegion>
  )
}
