/**
 * discos que su metadata está oculta en spotify y que no son stremeables
 *
 * keywords: si la consulta del usuario está incluída entonces sacamos de aquí el id
 */
export const CATALOG_EXTRAS = [
  {
    id: '2rT82YYlV9UoxBYLIezkRq',
    title: 'Lift Your Skinny Fists Like Antennas to Heaven',
    artist: 'Godspeed You! Black Emperor',
    keywords: [
      'lift your skinny fists',
      'skinny fists',
      'antennas to heaven',
      'lift your skinny',
      'godspeed you',
      'godspeed you black emperor',
    ],
  },

  {
    id: '20YQiWvyD8Yi7Xge7ukVrm',
    title: 'Loveless',
    artist: 'my bloody valentine',
    keywords: [
      'loveless',
      'my bloody valentine',
      'lovele',
      'my bloody',
      'bloody valentine',
    ],
  },

  {
    id: '4DH7vXyYdLG0OWvnoI48GJ',
    title: 'Endless',
    artist: 'Frank Ocean',
    keywords: [
      'endless',
      'frank ocean',
      'endless frank ocean',
      'endle',
      'endless frank',
    ],
  },

  {
    id: '182D7nDZqcYghZKQxnSJ03',
    title: 'Nostalgia Ultra',
    artist: 'Frank Ocean',
    keywords: [
      'nostalgia ultra',
      'frank ocean',
      'nostalgia frank ocean',
      'nostalgia ultra frank ocean',
      'ultra frank',
      'nostalgia frank',
    ],
  },

  {
    id: '2WIJUm8je4Pz033J9pP2uA',
    title: 'Ex Military',
    artist: 'Death Grips',
    keywords: [
      'ex military',
      'death grips',
      'ex military death grips',
      'ex military death',
      'ex military grips',
      'military death grips',
      'exmilitary',
    ],
  },

  {
    id: '56AnBpwjok0M4gUhgMRLxi',
    title: 'Diamond Jubilee',
    artist: 'Cindy Lee',
    keywords: [
      'diamond jubilee',
      'cindy lee',
      'diamond cindy',
      'cindy diamond jubilee',
    ],
  },

  {
    id: '11cVBbfOAdGzq6lMMscDOC',
    title: 'The Ecstatic',
    artist: 'Mos Def',
    keywords: [
      'the ecstatic',
      'mos def',
      'mos def the ecstatic',
    ],
  },

  // agregar más:
  // {
  //   id: 'SPOTIFY_ALBUM_ID_22CHARS',
  //   title: 'Album Title',
  //   artist: 'Artist',
  //   keywords: ['phrase one', 'phrase two'],
  // },
];

export function matchCatalogExtras(query) {
  const q = String(query || '').toLowerCase().trim();
  if (q.length < 2) return [];

  const ids = [];
  for (const entry of CATALOG_EXTRAS) {
    const hit = (entry.keywords || []).some((kw) =>
      q.includes(String(kw).toLowerCase())
    );
    const titleHit =
      entry.title && q.includes(String(entry.title).toLowerCase().slice(0, 20));
    if (hit || titleHit) ids.push(entry.id);
  }
  return [...new Set(ids)];
}
