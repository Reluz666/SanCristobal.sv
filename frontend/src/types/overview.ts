export interface DashboardHourlySales {
  range: string;
  count: number;
  total: string;
}

export interface DashboardTopProduct {
  uuid: string;
  sku: string;
  name: string;
  unit_code: string;
  quantity_sold: string;
  total_sold: string;
  share: number;
  sale_price: string;
  track_stock: boolean;
  stock: string | null;
}

export interface DashboardLowStockProduct {
  uuid: string;
  sku: string;
  name: string;
  unit_code: string;
  stock: string;
  min_stock: string;
}

export interface DashboardSummary {
  business_date: string;
  timezone: string;
  currency: "PEN" | "USD";
  generated_at: string;
  warehouse: { uuid: string; name: string } | null;
  permissions: {
    sales: boolean;
    products: boolean;
  };
  sales: {
    count: number;
    total: string;
    average_ticket: string;
  } | null;
  hourly_sales: DashboardHourlySales[];
  active_products_count: number | null;
  top_products: DashboardTopProduct[];
  stock: {
    tracked_products_count: number;
    low_stock_count: number;
    low_stock_products: DashboardLowStockProduct[];
  } | null;
}
