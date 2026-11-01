import { CardGridSkeleton, HeaderSkeleton, LoadingRegion } from "@/components/loading/skeletons"

export default function Loading() {
  return (
    <LoadingRegion label="Loading">
      <div className="container-page grid gap-8 py-10 md:py-14">
        <HeaderSkeleton />
        <CardGridSkeleton />
      </div>
    </LoadingRegion>
  )
}
