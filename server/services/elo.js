export function computeEloChange(ratingA, ratingB, scoreA, k = 32) {
  const Qa = Math.pow(10, ratingA / 400);
  const Qb = Math.pow(10, ratingB / 400);
  const Ea = Qa / (Qa + Qb);
  const changeA = Math.round(k * (scoreA - Ea));
  const changeB = -changeA;
  return { changeA, changeB };
}