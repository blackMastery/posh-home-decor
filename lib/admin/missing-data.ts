/** PostgREST filter (product_cards) for products missing shop-filter data: no attribute values, or no dimensions. */
export const MISSING_DATA_FILTER =
  "attribute_value_count.eq.0,and(height_cm.is.null,width_cm.is.null,depth_cm.is.null,diameter_cm.is.null)";
