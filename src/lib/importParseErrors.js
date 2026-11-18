/**
 * Human-readable validation messages for rejected .txt lines.
 * The parser remains the source of truth; UI only explains its errors.
 */
export function describeImportParseError(reason) {
  switch (reason) {
    case 'invalid_count':
      return 'Listen count must be between 1 and 50';
    case 'no_count_prefix':
      return 'Start the line with a count, e.g. 1- Album, Artist';
    case 'no_title_artist_separator':
      return 'Separate the album and artist with a comma or a dash';
    case 'empty_title_or_artist':
      return 'Album title and artist cannot be empty';
    default:
      return 'Line format could not be read';
  }
}

export function hasImportParseErrors(preview) {
  return (preview?.parseErrors?.length || 0) > 0;
}
