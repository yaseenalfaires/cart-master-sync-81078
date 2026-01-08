-- Add cost_price column to products table
ALTER TABLE public.products ADD COLUMN cost_price numeric;

-- Rename the existing price column to selling_price for clarity
COMMENT ON COLUMN public.products.price IS 'Selling price to customers';
COMMENT ON COLUMN public.products.cost_price IS 'Cost/purchase price from supplier';