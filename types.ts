export type CategoryType = string;

export type MaterialCategoryKind = 'material' | 'equipment';

export interface MaterialCategory {
  id: string;
  main_category_id?: string;
  title: string;
  kind?: MaterialCategoryKind;
  resource_label: string;
  unit_label: string;
  default_unit: string;
  has_client_name: boolean;
  is_system?: boolean;
  price_per_m2?: number | null;
  group_prices_per_m2?: Record<string, number>;
}


export type MultiPageModeType = 'none' | 'sheets' | 'pages';
export type AllowedSidesType = 'both' | 'single_only' | 'duplex_only';
export type BlockPrintModeType = '4+4' | '1+1' | '0+0';
export type CoverPrintModeType = '4+4' | '4+0';
export type AllowedBlockPrintModesType = 'both' | '4+4' | '1+1' | '0+0';
export type AllowedCoverPrintModesType = 'both' | '4+4' | '4+0';
export type CostParamModeType = 'per_unit' | 'per_sheet' | 'per_order';
export type SubcategoryBadgeType = '' | 'hit' | 'new';
export type SchematicType =
  | 'auto'
  | 'flat'
  | 'calendar_house'
  | 'calendar_wall'
  | 'pocket_calendar'
  | 'booklet_1fold'
  | 'booklet_2fold'
  | 'catalog'
  | 'notepad_spiral'
  | 'folder'
  | 'box'
  | 'card_deck'
  | 'sticker_pack'
  | 'certificate'
  | 'banner'
  | 'mug'
  | 'tshirt'
  | 'stamp_round'
  | 'none';

export interface MainCategory {
  id: string;
  name: string;
  is_hidden?: boolean;
  is_accent?: boolean;
  image_url?: string;
}

export interface ProductCategory {
  id: string;
  parent_id?: string;
  name: string;
  icon: string;
  is_hidden?: boolean;
  is_featured?: boolean;
  image_url?: string;
  badge?: SubcategoryBadgeType;
}

export interface CatalogItemPublic {
  id: number;
  name: string;
  category?: string;
  group?: string;
  in_stock?: boolean;
  color_name?: string;
  color_hex?: string;
  roll_width_m?: number;
  roll_length_m?: number;
}

export interface SectionLimits {
  max_width_mm: number;
  max_height_mm: number;
  usable_width_mm?: number;
  usable_height_mm?: number;
  roll_width_mm?: number;
  bleed_mm?: number;
}

export interface CatalogLimits {
  usable_width_mm: number;
  usable_height_mm: number;
  sra3_width_mm?: number;
  sra3_height_mm?: number;
  bleed_mm?: number;
  by_main_category?: Record<string, SectionLimits>;
}

export type CostParamInputType = 'checkbox' | 'select' | 'number';

export interface CostParamOption {
  id: string;
  label: string;
  cost: number;
}

export interface ProductCostParam {
  id: string;
  name: string;
  cost: number;
  mode: CostParamModeType;
  is_enabled?: boolean;
  is_client_facing?: boolean;
  input_type?: CostParamInputType;
  default_value?: string | number | boolean;
  options?: CostParamOption[];
}

export interface ProductItem {
  id: number;
  category: string;
  name: string;
  product_kind?: string;
  width_mm: number;
  height_mm: number;
  allow_custom_size: boolean;
  multi_page_mode: MultiPageModeType;
  default_pages: number;
  allowed_sides: AllowedSidesType;
  has_cover_block?: boolean;
  allowed_block_print_modes?: AllowedBlockPrintModesType;
  allowed_cover_print_modes?: AllowedCoverPrintModesType;
  allowed_cover_paper_ids?: number[];
  schematic_type?: SchematicType;
  base_mm?: number;
  defect_percent?: number | null;
  is_hidden?: boolean;
  images?: string[];
  image_url?: string;
  pages_default?: number;
  cost_params?: ProductCostParam[];
  show_format_select?: boolean;
  show_print_sides?: boolean;
  show_paper_select?: boolean;
  show_lamination_select?: boolean;
  include_paper_cost?: boolean;
  include_print_cost?: boolean;
  include_toner_cost?: boolean;
  include_components_cost?: boolean;
  include_lamination_cost?: boolean;
  include_extra_params_cost?: boolean;
  include_defect_cost?: boolean;
  excluded_equipment_ids?: number[];
  enabled_equipment_ids?: number[];
  allowed_paper_ids: number[];
  allowed_lamination_ids: number[];
}

export interface CostItem {
  id: number;
  category: CategoryType;
  name: string;
  client_name: string;
  group?: string;
  in_stock?: boolean;
  color_name?: string;
  color_hex?: string;
  price: number;
  resource: number;
  roll_width_m?: number;
  roll_length_m?: number;
  cost_per_sqm?: number;
  unit: string;
}

export interface MarkupTier {
  min_qty: number;
  coefficient: number;
  page_coefficient?: number;
}

export interface Settings {
  sheet_length_m: number;
  sra3_width_mm?: number;
  sra3_height_mm?: number;
  usable_width_mm?: number;
  usable_height_mm?: number;
  bleed_mm?: number;
  defect_percent?: number;
  tax_percent?: number;
  main_category_params?: Record<string, Record<string, number>>;
  category_markups: Record<string, MarkupTier[]>;
  roles?: RoleDefinition[];
  role_permissions?: RolePermissionsMap;
  role_order_statuses?: RoleOrderStatusesMap;
}

export interface CalculationResult {
  client_price: number;
  unit_price: number;
  quantity: number;
  discount_percent?: number;
  original_client_price?: number;
  original_unit_price?: number;
  internal?: {
    main_category_id?: string;
    total_cost: number;
    cost_per_unit: number;
    profit: number;
    coefficient: number;
    page_coefficient?: number;
    defect_percent: number;
    defect_cost: number;
    tax_percent?: number;
    tax_cost?: number;
    sheets_needed: number;
    items_per_sheet: number;
    size_with_bleed: string;
    has_cover_block?: boolean;
    breakdown: {
      print_cost: number;
      toner_cost?: number;
      components_cost?: number;
      paper_cost: number;
      paper_cost_per_m2?: number;
      total_area_m2?: number;
      lamination_cost: number;
      extra_cost: number;
      a4_click_cost: number;
      a4_bw_click_cost?: number;
      sra3_click_cost: number;
      block_paper_cost?: number;
      block_print_cost?: number;
      block_sheets_needed?: number;
      block_print_mode?: string;
      cover_paper_cost?: number;
      cover_print_cost?: number;
      cover_sheets_needed?: number;
      cover_print_mode?: string;
      params?: Array<{
        id?: string;
        name: string;
        total: number;
        is_client_facing?: boolean;
      }>;
    };
  };
}

export interface EstimateItem {
  id: string;
  createdAt: string;
  productId?: number;
  paperId?: number;
  coverPaperId?: number;
  printSides?: number;
  blockPrintMode?: BlockPrintModeType;
  coverPrintMode?: CoverPrintModeType;
  laminationId?: number | null;
  laminationSides?: number;
  widthMm?: number;
  heightMm?: number;
  pagesCount?: number;
  selectedParams?: Record<string, string | number | boolean>;
  sheetsNeeded?: number;
  itemsPerSheet?: number;
  sheets_needed?: number;
  items_per_sheet?: number;
  mainCategoryId?: string;
  categoryName: string;
  productName: string;
  customNote?: string;
  formatLabel: string;
  paperLabel: string;
  printLabel: string;
  laminationLabel: string;
  pagesLabel?: string;
  extraParamsLabel: string;
  showPaper?: boolean;
  showPrint?: boolean;
  showLamination?: boolean;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface EstimateHeaderMeta {
  customerName?: string;
  comment?: string;
  discountPercent?: number;
  discountComment?: string;
  managerName?: string;
  managerPhone?: string;
  managerEmail?: string;
}

export interface CompanyDetails {
  company_name?: string;
  inn?: string;
  kpp?: string;
  legal_address?: string;
  bank_name?: string;
  bik?: string;
  checking_account?: string;
  correspondent_account?: string;
  phone?: string;
}

export type UserRole = 'client' | 'production' | 'manager' | 'admin' | (string & {});

export type PermissionKey =
  | 'manage_kp'
  | 'apply_discounts'
  | 'view_crm'
  | 'view_all_orders'
  | 'update_order_status'
  | 'manage_order_finances'
  | 'view_internal_metrics'
  | 'delete_orders'
  | 'manage_catalog'
  | 'manage_users';

export type RolePermissions = Record<PermissionKey, boolean>;

export interface RoleDefinition {
  id: string;
  name: string;
  is_system?: boolean;
  permissions: RolePermissions;
  allowed_order_statuses?: OrderStatus[];
}

export type RolePermissionsMap = Record<string, RolePermissions>;
export type RoleOrderStatusesMap = Record<string, OrderStatus[]>;

export type ClientType = 'individual' | 'legal';
export type PaymentMethod = 'cash' | 'card_on_delivery' | 'bank_transfer';

export interface AuthUser {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  name: string;
  phone?: string;
  role: UserRole;
  role_name?: string;
  permissions?: Partial<RolePermissions>;
  allowed_order_statuses?: OrderStatus[];
  is_email_verified: boolean;
  created_at?: string;
  client_type?: ClientType;
  company_details?: CompanyDetails;
  discount_percent?: number;
  discount_scope?: 'all' | 'selected';
  discount_main_categories?: string[];
  discount_categories?: string[];
  discount_products?: number[];
}

export type OrderStatus =
  | 'new'
  | 'awaiting_payment'
  | 'prepress'
  | 'in_progress'
  | 'ready'
  | 'completed'
  | 'cancelled';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface CrmOrderItem {
  id: string;
  mainCategoryId?: string;
  categoryName: string;
  productName: string;
  customNote?: string;
  formatLabel: string;
  paperLabel: string;
  printLabel: string;
  laminationLabel: string;
  pagesLabel?: string;
  extraParamsLabel: string;
  showPaper?: boolean;
  showPrint?: boolean;
  showLamination?: boolean;
  quantity: number;
  sheets_needed: number;
  sheetsNeeded?: number;
  items_per_sheet: number;
  itemsPerSheet?: number;
  unitPrice?: number;
  totalPrice?: number;
}

export interface CrmOrderInternalMetrics {
  total_cost: number;
  tax_cost: number;
  profit: number;
  total_sra3_sheets: number;
}

export interface CrmOrderComment {
  id: string;
  text: string;
  author_name?: string;
  author_id?: number | null;
  created_at?: string;
}

export interface CrmOrder {
  id: number;
  created_at: string;
  deadline_date: string;
  user_id?: number | null;
  manager_id?: number | null;
  manager_name?: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  client_type?: ClientType;
  payment_method?: PaymentMethod;
  comment: string;
  comment_author_id?: number | null;
  comment_author_name?: string;
  comment_updated_at?: string;
  comments?: CrmOrderComment[];
  design_link: string;
  need_invoice?: boolean;
  company_details?: CompanyDetails;
  status: OrderStatus;
  payment_status?: PaymentStatus;
  discount_percent?: number;
  discount_comment?: string;
  discount_author_id?: number | null;
  discount_author_name?: string;
  discount_updated_at?: string;
  subtotal_price?: number;
  total_price?: number;
  items: CrmOrderItem[];
  internal_metrics?: CrmOrderInternalMetrics;
}

export interface CrmNotification {
  id: string;
  order_id: number;
  type: 'order_created' | 'status_changed' | 'manager_assigned' | string;
  status: OrderStatus;
  client_name: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

