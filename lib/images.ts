/**
 * Static editorial imagery.
 *
 * The live schema has no image columns, so these are presentation assets only —
 * they are not database data and never stand in for a failed read. Service and
 * barber photos come from `image_url`/`avatar_url` once those columns exist;
 * until then cards fall back to the branded gradient in `SmartImage`.
 */

const UNSPLASH = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=70`;

export const IMAGES = {
  hero: UNSPLASH("photo-1622286342621-4bd786c2447c"),
  shop: UNSPLASH("photo-1585747860715-2ba37e788b70"),
  serviceCut: UNSPLASH("photo-1599351431202-1e0f0137899a"),
  serviceWash: UNSPLASH("photo-1560066984-138dadb4c035"),
  serviceShave: UNSPLASH("photo-1621605815971-fbc98d665033"),
  serviceSet: UNSPLASH("photo-1503951914875-452162b0f3f1"),
  serviceColor: UNSPLASH("photo-1516975080664-ed2fc6a32937"),
  serviceBlond: UNSPLASH("photo-1605497788044-5a32c7078486"),
  barberA: UNSPLASH("photo-1507003211169-0a1dd7228f2d"),
  barberB: UNSPLASH("photo-1500648767791-00dcc994a43e"),
  barberC: UNSPLASH("photo-1531384441138-2736e62e0919"),
  barberD: UNSPLASH("photo-1521119989659-a83eee488004"),
} as const;
