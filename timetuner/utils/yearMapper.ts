export const START_YEAR = 1970;
export const END_YEAR = 2024;
export const TOTAL_YEARS = END_YEAR - START_YEAR + 1;
export const DEGREES_PER_YEAR = 360 / TOTAL_YEARS;

/**
 * Converts a rotation angle (in degrees) to the corresponding year.
 * Assumes 0 degrees is START_YEAR.
 */
export const angleToYear = (angle: number): number => {
  // Normalize angle to positive 0-360 range
  let normalizedAngle = angle % 360;
  if (normalizedAngle < 0) normalizedAngle += 360;

  const yearIndex = Math.round(normalizedAngle / DEGREES_PER_YEAR);
  const year = START_YEAR + yearIndex;
  
  // Clamp to valid range
  return Math.min(Math.max(year, START_YEAR), END_YEAR);
};

/**
 * Converts a year to the corresponding rotation angle (in degrees).
 */
export const yearToAngle = (year: number): number => {
  const clampedYear = Math.min(Math.max(year, START_YEAR), END_YEAR);
  const yearIndex = clampedYear - START_YEAR;
  return yearIndex * DEGREES_PER_YEAR;
};

/**
 * Snaps an angle to the nearest year's angle.
 */
export const snapToNearestYearAngle = (angle: number): number => {
  const year = angleToYear(angle);
  return yearToAngle(year);
};
