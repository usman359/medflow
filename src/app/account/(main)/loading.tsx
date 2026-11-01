import { HeaderSkeleton, ListSkeleton, LoadingRegion } from "@/components/loading/skeletons"

export default function Loading() {
  return (
    <LoadingRegion label="Loading your account">
      <div className="grid gap-6">
        <HeaderSkeleton />
        <ListSkeleton rows={3} className="h-24" />
      </div>
    </LoadingRegion>
  )
}
