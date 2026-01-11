import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Scan, Plus, Minus, Trash2, CreditCard, Wallet, Printer } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/formatting";
import { useCurrency } from "@/contexts/CurrencyContext";

interface ProductSize {
  id: string;
  product_id: string;
  size: string;
  quantity: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  barcode: string;
  category: string;
  color: string;
  sizes?: ProductSize[];
}

interface CartItem extends Product {
  quantity: number;
  selectedSize: string;
  sizeId: string;
}

const POS = () => {
  const { currency } = useCurrency();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "credit_card" | "debit_card">("cash");
  const [loading, setLoading] = useState(false);
  
  // Size selection dialog
  const [sizeDialogOpen, setSizeDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>("");

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select("*")
      .order("name");

    if (productsError) {
      toast.error("فشل في جلب المنتجات");
      return;
    }

    // Fetch sizes for all products
    const { data: sizesData, error: sizesError } = await supabase
      .from("product_sizes")
      .select("*");

    if (sizesError) {
      console.error("Failed to fetch sizes:", sizesError);
    }

    // Map sizes to products
    const productsWithSizes = (productsData || []).map(product => ({
      ...product,
      sizes: (sizesData || []).filter(size => size.product_id === product.id)
    }));

    setProducts(productsWithSizes);
  };

  const handleBarcodeSearch = async () => {
    if (!barcodeInput.trim()) return;

    const product = products.find(p => p.barcode === barcodeInput);
    if (product) {
      handleProductClick(product);
      setBarcodeInput("");
    } else {
      toast.error("المنتج غير موجود");
    }
  };

  const handleProductClick = (product: Product) => {
    if (product.sizes && product.sizes.length > 0) {
      // Product has sizes, show size selection dialog
      const availableSizes = product.sizes.filter(s => s.quantity > 0);
      if (availableSizes.length === 0) {
        toast.error("المنتج غير متوفر في المخزون");
        return;
      }
      setSelectedProduct(product);
      setSelectedSize("");
      setSizeDialogOpen(true);
    } else {
      // Product doesn't have sizes, add directly
      addToCartWithoutSize(product);
    }
  };

  const addToCartWithoutSize = (product: Product) => {
    const existingItem = cart.find(item => item.id === product.id && !item.selectedSize);
    
    if (existingItem) {
      if (existingItem.quantity < product.stock) {
        setCart(cart.map(item =>
          item.id === product.id && !item.selectedSize
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ));
      } else {
        toast.error("المخزون غير كافي");
      }
    } else {
      if (product.stock > 0) {
        setCart([...cart, { ...product, quantity: 1, selectedSize: "", sizeId: "" }]);
      } else {
        toast.error("المنتج غير متوفر في المخزون");
      }
    }
  };

  const addToCartWithSize = () => {
    if (!selectedProduct || !selectedSize) {
      toast.error("الرجاء اختيار المقاس");
      return;
    }

    const sizeInfo = selectedProduct.sizes?.find(s => s.size === selectedSize);
    if (!sizeInfo || sizeInfo.quantity <= 0) {
      toast.error("المقاس غير متوفر");
      return;
    }

    const cartKey = `${selectedProduct.id}-${selectedSize}`;
    const existingItem = cart.find(item => `${item.id}-${item.selectedSize}` === cartKey);

    if (existingItem) {
      if (existingItem.quantity < sizeInfo.quantity) {
        setCart(cart.map(item =>
          `${item.id}-${item.selectedSize}` === cartKey
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ));
      } else {
        toast.error("المخزون غير كافي لهذا المقاس");
      }
    } else {
      setCart([...cart, { 
        ...selectedProduct, 
        quantity: 1, 
        selectedSize: selectedSize,
        sizeId: sizeInfo.id
      }]);
    }

    setSizeDialogOpen(false);
    setSelectedProduct(null);
    setSelectedSize("");
    toast.success(`تمت إضافة ${selectedProduct.name} (${selectedSize}) إلى السلة`);
  };

  const updateQuantity = (cartKey: string, change: number) => {
    setCart(cart.map(item => {
      const itemKey = item.selectedSize ? `${item.id}-${item.selectedSize}` : item.id;
      if (itemKey === cartKey) {
        const newQuantity = item.quantity + change;
        if (newQuantity <= 0) {
          return item;
        }
        
        // Check stock limit
        let maxStock: number;
        if (item.selectedSize && item.sizeId) {
          const product = products.find(p => p.id === item.id);
          const sizeInfo = product?.sizes?.find(s => s.size === item.selectedSize);
          maxStock = sizeInfo?.quantity || 0;
        } else {
          maxStock = item.stock;
        }
        
        if (newQuantity > maxStock) {
          toast.error("المخزون غير كافي");
          return item;
        }
        return { ...item, quantity: newQuantity };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (cartKey: string) => {
    setCart(cart.filter(item => {
      const itemKey = item.selectedSize ? `${item.id}-${item.selectedSize}` : item.id;
      return itemKey !== cartKey;
    }));
  };

  const calculateTotal = () => {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    return { total };
  };

  const printInvoice = () => {
    const { total } = calculateTotal();
    const invoiceContent = `
      <html dir="rtl">
        <head>
          <title>فاتورة</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
            th { background-color: #f2f2f2; }
            .totals { margin-top: 20px; }
            .totals div { margin: 5px 0; }
          </style>
        </head>
        <body>
          <h1>فاتورة البيع</h1>
          <p>التاريخ: ${new Date().toLocaleDateString('ar-EG')}</p>
          <p>طريقة الدفع: ${paymentMethod === 'cash' ? 'نقداً' : paymentMethod === 'credit_card' ? 'بطاقة ائتمان' : 'بطاقة مدين'}</p>
          <table>
            <thead>
              <tr>
                <th>المنتج</th>
                <th>المقاس</th>
                <th>السعر</th>
                <th>الكمية</th>
                <th>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              ${cart.map(item => `
                <tr>
                  <td>${item.name}</td>
                  <td>${item.selectedSize || "-"}</td>
                  <td>${formatCurrency(item.price, currency)}</td>
                  <td>${item.quantity}</td>
                  <td>${formatCurrency(item.price * item.quantity, currency)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="totals">
            <div><strong>الإجمالي:</strong> ${formatCurrency(total, currency)}</div>
          </div>
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(invoiceContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("السلة فارغة");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("غير مصرح");

      const { total } = calculateTotal();

      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          total,
          tax: 0,
          payment_method: paymentMethod,
          employee_id: user.id,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items and update stock
      for (const item of cart) {
        await supabase.from("sale_items").insert({
          sale_id: sale.id,
          product_id: item.id,
          quantity: item.quantity,
          price_at_sale: item.price,
          size: item.selectedSize || null,
        });

        if (item.selectedSize && item.sizeId) {
          // Update size quantity
          const { data: currentSize, error: fetchError } = await supabase
            .from("product_sizes")
            .select("quantity")
            .eq("id", item.sizeId)
            .single();

          if (fetchError) throw fetchError;

          const newQuantity = Math.max(0, (currentSize?.quantity || 0) - item.quantity);
          
          await supabase
            .from("product_sizes")
            .update({ quantity: newQuantity })
            .eq("id", item.sizeId);

          // Update total product stock
          const { data: allSizes } = await supabase
            .from("product_sizes")
            .select("quantity")
            .eq("product_id", item.id);

          const totalStock = (allSizes || []).reduce((sum, s) => sum + s.quantity, 0) - item.quantity;
          
          await supabase
            .from("products")
            .update({ stock: Math.max(0, totalStock) })
            .eq("id", item.id);
        } else {
          // No size, update product stock directly
          const { data: currentProduct, error: fetchError } = await supabase
            .from("products")
            .select("stock")
            .eq("id", item.id)
            .single();

          if (fetchError) throw fetchError;

          const newStock = (currentProduct?.stock || 0) - item.quantity;
          
          await supabase
            .from("products")
            .update({ stock: Math.max(0, newStock) })
            .eq("id", item.id);
        }
      }

      toast.success(`تمت عملية البيع! الإجمالي: ${formatCurrency(total, currency)}`);
      
      // Print invoice automatically after successful checkout
      printInvoice();
      
      setCart([]);
      fetchProducts();
    } catch (error) {
      console.error("خطأ في عملية البيع:", error);
      toast.error("فشل في إتمام عملية البيع");
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.barcode?.includes(searchTerm)
  );

  const { total } = calculateTotal();

  const getAvailableSizes = (product: Product) => {
    return product.sizes?.filter(s => s.quantity > 0) || [];
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">نقطة البيع</h1>
        <p className="text-muted-foreground mt-2">معالجة معاملات العملاء</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Products Section */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>ماسح الباركود</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="امسح أو أدخل الباركود..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleBarcodeSearch()}
                />
                <Button onClick={handleBarcodeSearch}>
                  <Scan className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>المنتجات</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="ابحث عن المنتجات..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mb-4"
              />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                {filteredProducts.map((product) => {
                  const availableSizes = getAvailableSizes(product);
                  const hasStock = product.sizes && product.sizes.length > 0 
                    ? availableSizes.length > 0 
                    : product.stock > 0;
                  
                  return (
                    <Button
                      key={product.id}
                      variant="outline"
                      className="h-auto flex-col p-4 text-right"
                      onClick={() => handleProductClick(product)}
                      disabled={!hasStock}
                    >
                      <span className="font-semibold">{product.name}</span>
                      <span className="text-xs text-muted-foreground">{product.color}</span>
                      <span className="text-sm text-muted-foreground">{formatCurrency(product.price, currency)}</span>
                      {product.sizes && product.sizes.length > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {availableSizes.length > 0 
                            ? `${availableSizes.length} مقاسات متوفرة`
                            : "غير متوفر"}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          المخزون: {formatNumber(product.stock, 0)}
                        </span>
                      )}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cart Section */}
        <div className="space-y-4">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>السلة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {cart.map((item) => {
                  const cartKey = item.selectedSize ? `${item.id}-${item.selectedSize}` : item.id;
                  return (
                    <div key={cartKey} className="flex items-center justify-between p-2 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.name}</p>
                        {item.selectedSize && (
                          <p className="text-xs text-primary">المقاس: {item.selectedSize}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(item.price, currency)} × {formatNumber(item.quantity, 0)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(cartKey, -1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(cartKey, 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removeFromCart(cartKey)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-lg font-bold">
                  <span>الإجمالي:</span>
                  <span>{formatCurrency(total, currency)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">طريقة الدفع</label>
                <ToggleGroup type="single" value={paymentMethod} onValueChange={(value) => value && setPaymentMethod(value as any)} className="justify-start">
                  <ToggleGroupItem value="cash" aria-label="نقداً" className="flex-1">
                    <Wallet className="w-4 h-4 ml-2" />
                    نقداً
                  </ToggleGroupItem>
                  <ToggleGroupItem value="credit_card" aria-label="بطاقة ائتمان" className="flex-1">
                    <CreditCard className="w-4 h-4 ml-2" />
                    ائتمان
                  </ToggleGroupItem>
                  <ToggleGroupItem value="debit_card" aria-label="بطاقة مدين" className="flex-1">
                    <CreditCard className="w-4 h-4 ml-2" />
                    مدين
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleCheckout}
                disabled={loading || cart.length === 0}
              >
                <CreditCard className="w-4 h-4 ml-2" />
                {loading ? "جاري المعالجة..." : "إتمام البيع"}
              </Button>

              {cart.length > 0 && (
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={printInvoice}
                >
                  <Printer className="w-4 h-4 ml-2" />
                  طباعة الفاتورة
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Size Selection Dialog */}
      <Dialog open={sizeDialogOpen} onOpenChange={setSizeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>اختر المقاس</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              <div>
                <p className="font-medium">{selectedProduct.name}</p>
                <p className="text-sm text-muted-foreground">{selectedProduct.color}</p>
                <p className="text-sm">{formatCurrency(selectedProduct.price, currency)}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">المقاس</label>
                <Select value={selectedSize} onValueChange={setSelectedSize}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المقاس" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedProduct.sizes
                      ?.filter(s => s.quantity > 0)
                      .map(size => (
                        <SelectItem key={size.id} value={size.size}>
                          {size.size} (متوفر: {size.quantity})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSizeDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button onClick={addToCartWithSize} disabled={!selectedSize}>
                  إضافة للسلة
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default POS;
