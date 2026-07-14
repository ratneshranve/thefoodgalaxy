export async function upsertOutletTimingsForRestaurant(_restaurantId, outletTimings = []) {
  return Array.isArray(outletTimings) ? outletTimings : [];
}

export async function getOutletTimingsForRestaurant() {
  return [];
}
