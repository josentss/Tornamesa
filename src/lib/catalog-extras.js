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
      'gybe',
    ],
  },

  {
    id: '0XKw8i6Hlz6oV9moQcjjR5',
    title: 'Yanqui U.X.O.',
    artist: 'Godspeed You! Black Emperor',
    keywords: [
      'yanqui uxo',
      'yanqui',
      'godspeed you black emperor',
      'godspeed you',
      'gybe',
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

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function matchCatalogExtras(query) {
  const q = norm(query);
  if (q.length < 2) return [];

  const ids = [];
  for (const entry of CATALOG_EXTRAS) {
    const titleN = norm(entry.title);
    const titleHit =
      titleN.length >= 4 &&
      (q.includes(titleN) ||
        titleN.includes(q) ||
        q.split(' ').filter((t) => t.length > 2 && titleN.includes(t))
          .length >= 2);

    const kwHit = (entry.keywords || []).some((kw) => {
      const k = norm(kw);
      if (k.length < 4) return false;
      return q.includes(k) || k.includes(q);
    });

    if (titleHit || kwHit) ids.push(entry.id);
  }
  return [...new Set(ids)];
}
