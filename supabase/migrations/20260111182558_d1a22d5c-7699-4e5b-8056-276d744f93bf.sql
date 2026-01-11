-- Create product_sizes table to track inventory by size
CREATE TABLE public.product_sizes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, size)
);

-- Enable RLS
ALTER TABLE public.product_sizes ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_sizes
CREATE POLICY "Anyone authenticated can view product sizes" 
ON public.product_sizes 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can insert product sizes" 
ON public.product_sizes 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update product sizes" 
ON public.product_sizes 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can update product size quantity" 
ON public.product_sizes 
FOR UPDATE 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete product sizes" 
ON public.product_sizes 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add size column to sale_items to track which size was sold
ALTER TABLE public.sale_items ADD COLUMN size TEXT;

-- Create trigger for updating updated_at on product_sizes
CREATE TRIGGER update_product_sizes_updated_at
BEFORE UPDATE ON public.product_sizes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();