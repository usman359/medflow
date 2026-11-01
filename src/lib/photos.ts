/** Unsplash photography. Ids are verified to resolve; `unsplash()` sizes them via imgix params. */

export function unsplash(id: string, width = 800): string {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=75`
}

export const PHOTOS = {
  heroConsultation: "1584516150909-c43483ee7932",
  heroCheckup: "1631815588090-d4bfec5b1ccb",
  clinicExterior: "1586773860418-d37222d8fce3",
  clinicLobby: "1519494026892-80bbd2d6fd0d",
  clinicRoom: "1629909613654-28e377c37b09",
} as const

/** Doctor portraits, keyed by the seed doctor that uses them. */
export const DOCTOR_PORTRAITS = {
  rahimKhan: "1612349317150-e413f6a5b16d",
  elenaMorales: "1559839734-2b71ea197ec2",
  marcusBell: "1622253692010-333f2da6031d",
  lukasWeber: "1537368910025-700350fe46c7",
  sofiaRinaldi: "1594824476967-48c8b964273f",
  amaraOkafor: "1651008376811-b90baee60c1f",
  margaretDoyle: "1631217868264-e5b90bb7e133",
  nkechiAdeyemi: "1666214280557-f1b5022eb634",
  priyaNair: "1614608682850-e0d6ed316d47",
  danielTan: "1622902046580-2b47f47f5471",
  kenjiSato: "1580281658626-ee379f3cce93",
  graceMensah: "1643297654416-05795d62e39c",
} as const
