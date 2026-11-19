import { E3Error } from "../errors.js";

function keyOf(collegeId, branchId, seatTypeCode) {
  return JSON.stringify([collegeId, branchId, seatTypeCode]);
}

export function buildSeatMap(seatPools) {
  const seatMap = new Map();
  for (const pool of seatPools) {
    if (
      !Number.isSafeInteger(pool.totalSeats) ||
      !Number.isSafeInteger(pool.availableSeats) ||
      pool.availableSeats < 0 ||
      pool.availableSeats > pool.totalSeats
    ) {
      throw new E3Error(
        "INVALID_SEAT_POOL",
        `Invalid capacity for pool ${pool.id}`,
        {
          poolId: pool.id,
        },
      );
    }
    const key = keyOf(pool.collegeId, pool.branchId, pool.seatTypeCode);
    if (seatMap.has(key)) {
      throw new E3Error(
        "DUPLICATE_POOL_KEY",
        `Duplicate pool key for pool ${pool.id}`,
        {
          poolId: pool.id,
        },
      );
    }
    seatMap.set(key, {
      id: pool.id,
      collegeId: pool.collegeId,
      branchId: pool.branchId,
      seatTypeCode: pool.seatTypeCode,
      totalSeats: pool.totalSeats,
      available: pool.availableSeats,
    });
  }
  return seatMap;
}

export function findPool(seatMap, collegeId, branchId, seatTypeCode) {
  return seatMap.get(keyOf(collegeId, branchId, seatTypeCode));
}
