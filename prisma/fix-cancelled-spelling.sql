-- Run in Neon to fix existing orders with US spelling
UPDATE orders SET status = 'Cancelled' WHERE status = 'Canceled';
