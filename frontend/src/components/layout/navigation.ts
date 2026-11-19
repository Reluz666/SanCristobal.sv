import {
  Boxes,
  LayoutDashboard,
  ReceiptText,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  shortcut?: string;
  hint?: string;
  permission?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operación",
    items: [
      {
        label: "Resumen",
        to: "/",
        icon: LayoutDashboard,
        hint: "Vista consolidada del turno",
        permission: "dashboard.view",
      },
      {
        label: "Ventas",
        to: "/pos",
        icon: ShoppingCart,
        shortcut: "F4",
        hint: "Emisión directa y bultos",
        permission: "pos.operate",
      },
    ],
  },
  {
    label: "Gestión",
    items: [
      {
        label: "Inventario",
        to: "/inventario",
        icon: Boxes,
        hint: "Catálogo, stock y Kardex",
        permission: "inventory.view",
      },
      {
        label: "Facturación",
        to: "/facturacion",
        icon: ReceiptText,
        hint: "Comprobantes y SUNAT",
        permission: "invoicing.view",
      },
    ],
  },
  {
    label: "Sistema",
    items: [
      {
        label: "Configuración",
        to: "/configuracion",
        icon: Settings2,
        hint: "Empresa, marca blanca y series",
        permission: "settings.manage",
      },
      {
        label: "Seguridad",
        to: "/seguridad",
        icon: ShieldCheck,
        hint: "Usuarios, roles y auditoría",
        permission: "users.view",
      },
    ],
  },
];

export interface PageMeta {
  section: string;
  title: string;
  description: string;
}

export const PAGE_META: Record<string, PageMeta> = {
  "/": {
    section: "Operación",
    title: "Resumen",
    description: "Vista consolidada de la operación de la sede principal.",
  },
  "/pos": {
    section: "Operación",
    title: "Ventas",
    description: "Venta directa de mercadería, lector de barras y comprobantes.",
  },
  "/inventario": {
    section: "Gestión",
    title: "Inventario",
    description: "Catálogo, existencias por almacén y trazabilidad Kardex.",
  },
  "/facturacion": {
    section: "Gestión",
    title: "Facturación",
    description: "Comprobantes electrónicos e integración con SUNAT.",
  },
  "/configuracion": {
    section: "Sistema",
    title: "Configuración",
    description: "Datos fiscales, marca blanca, almacenes y series.",
  },
  "/seguridad": {
    section: "Sistema",
    title: "Seguridad",
    description: "Control de acceso, roles y auditoría de operaciones.",
  },
};

export const DEFAULT_PAGE_META: PageMeta = {
  section: "Sistema",
  title: "Página no encontrada",
  description: "La ruta solicitada no existe en esta instalación.",
};
