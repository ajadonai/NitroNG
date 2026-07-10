export function buildOrderDisplayGroups(orderRefs) {
  const groups = [];
  const batches = new Map();

  for (const order of orderRefs) {
    if (!order.batchId) {
      groups.push({
        key: order.id,
        singleId: order.id,
        batchId: null,
        createdAt: order.createdAt,
      });
      continue;
    }

    if (!batches.has(order.batchId)) {
      const group = {
        key: order.batchId,
        singleId: null,
        batchId: order.batchId,
        createdAt: order.createdAt,
      };
      batches.set(order.batchId, group);
      groups.push(group);
    }
  }

  return groups;
}
