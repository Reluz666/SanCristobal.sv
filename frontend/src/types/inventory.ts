export interface InventorySummary {
  warehouse: { uuid: string; name: string } | null;
  active_products_count: number;
  total_units: string;
  retail_value: string;
  low_stock_count: number;
}
