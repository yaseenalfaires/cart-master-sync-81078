import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import { Scan, Plus, Minus, Trash2, CreditCard, Wallet, Printer } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/formatting";
import { useCurrency } from "@/contexts/CurrencyContext";

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  barcode: string;
}

interface CartItem extends Product {
  quantity: number;
}

const POS = () => {
  const { currency } = useCurrency();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "credit_card" | "debit_card">("cash");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name");

    if (error) {
      toast.error("فشل في جلب المنتجات");
    } else {
      setProducts(data || []);
    }
  };

  const handleBarcodeSearch = async () => {
    if (!barcodeInput.trim()) return;

    const product = products.find(p => p.barcode === barcodeInput);
    if (product) {
      addToCart(product);
      setBarcodeInput("");
      toast.success(`تمت إضافة ${product.name} إلى السلة`);
    } else {
      toast.error("المنتج غير موجود");
    }
  };

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
      if (existingItem.quantity < product.stock) {
        setCart(cart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ));
      } else {
        toast.error("المخزون غير كافي");
      }
    } else {
      if (product.stock > 0) {
        setCart([...cart, { ...product, quantity: 1 }]);
      } else {
        toast.error("المنتج غير متوفر في المخزون");
      }
    }
  };

  const updateQuantity = (productId: string, change: number) => {
    setCart(cart.map(item => {
      if (item.id === productId) {
        const newQuantity = item.quantity + change;
        if (newQuantity <= 0) {
          return item;
        }
        if (newQuantity > item.stock) {
          toast.error("المخزون غير كافي");
          return item;
        }
        return { ...item, quantity: newQuantity };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.id !== productId));
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
                <th>السعر</th>
                <th>الكمية</th>
                <th>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              ${cart.map(item => `
                <tr>
                  <td>${item.name}</td>
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
        });

        // Get current stock from database and decrement it
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
                {filteredProducts.map((product) => (
                  <Button
                    key={product.id}
                    variant="outline"
                    className="h-auto flex-col p-4 text-right"
                    onClick={() => addToCart(product)}
                  >
                    <span className="font-semibold">{product.name}</span>
                    <span className="text-sm text-muted-foreground">{formatCurrency(product.price, currency)}</span>
                    <span className="text-xs text-muted-foreground">المخزون: {formatNumber(product.stock, 0)}</span>
                  </Button>
                ))}
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
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(item.price, currency)} × {formatNumber(item.quantity, 0)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateQuantity(item.id, -1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateQuantity(item.id, 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
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
    </div>
  );
};

export default POS;
